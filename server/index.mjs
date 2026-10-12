import express from 'express'
import { spawn } from 'node:child_process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { discoverProviders, foldersOverlap, launchArgs } from './providers.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
// Installed CLI writes history to a user-writable directory. Source development
// keeps the existing .local/tasks.json location for backwards compatibility.
const STORE = join(process.env.AGENT_OFFICE_DATA_DIR || join(ROOT, '.local'), 'tasks.json')
const PORT = Number(process.env.PORT || 4300)
const MAX_TASKS = 150
const MAX_PROMPT = 10000
const ROLES = ['atlas', 'nova', 'pixel', 'sentinel']
const active = new Map()
const clients = new Set()
let tasks = []
let persistTimer
let persistChain = Promise.resolve()

const providers = discoverProviders()
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '20kb' }))
app.use('/api', (req, res, next) => {
  // The API controls local processes; browsers from other websites must not use it.
  if (!['localhost', '127.0.0.1'].includes(req.hostname)) {
    return res.status(403).json({ error: 'Host não autorizado.' })
  }
  const origin = req.headers.origin
  const allowed = origin && ['127.0.0.1', 'localhost'].some(host =>
    origin === `http://${host}:${PORT}` || origin === `http://${host}:5173`)
  if (origin && !allowed) return res.status(403).json({ error: 'Origem não autorizada.' })
  next()
})

const shrink = (value, max = 190) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').slice(0, max)
const stamp = () => new Date().toISOString()
const visible = task => ({ ...task })

function snapshot() {
  return {
    connected: true,
    codexAvailable: providers.find(provider => provider.id === 'codex').available,
    providers: providers.map(({ id, name, available }) => ({ id, name, available })),
    defaultWorkspace: process.env.AGENT_OFFICE_WORKSPACE || ROOT,
    tasks: tasks.map(visible),
  }
}

function persistHistory() {
  const contents = JSON.stringify(tasks, null, 2)
  persistChain = persistChain.then(async () => {
    await mkdir(dirname(STORE), { recursive: true })
    const temporary = `${STORE}.${randomUUID()}.tmp`
    await writeFile(temporary, contents)
    await rename(temporary, STORE)
  }).catch(error => console.error('Could not save task history:', error.message))
}

function notify() {
  const data = `event: state\ndata: ${JSON.stringify(snapshot())}\n\n`
  for (const client of clients) client.write(data)
  clearTimeout(persistTimer)
  persistTimer = setTimeout(persistHistory, 300)
}

function addEvent(task, message, kind = 'info') {
  task.events = [...task.events, { id: randomUUID(), at: stamp(), kind, message: shrink(message, 350) }].slice(-35)
  task.updatedAt = stamp()
  notify()
}

function parseMessage(task, data) {
  if (!data || typeof data !== 'object') return
  if (task.provider === 'claude') {
    if (data.type === 'system' && data.session_id) task.threadId = data.session_id
    if (data.type === 'assistant') {
      for (const block of data.message?.content || []) {
        if (block.type === 'tool_use') {
          task.phase = /WebSearch|WebFetch/i.test(block.name) ? 'researching' : 'coding'
          addEvent(task, `Claude usou ${shrink(block.name)}.`)
        } else if (block.type === 'text' && block.text) {
          task.lastMessage = shrink(block.text, 500)
          addEvent(task, 'Claude respondeu: ' + shrink(block.text, 140))
        }
      }
    }
    if (data.type === 'result') {
      if (data.result) task.lastMessage = shrink(data.result, 500)
      if (data.usage) task.usage = data.usage
      if (data.is_error) task.failure = shrink(data.result || 'Claude Code relatou erro.', 500)
      task.phase = 'finishing'
    }
    return
  }
  if (task.provider === 'gemini') {
    if (data.type === 'init') task.threadId = data.session_id || null
    if (data.type === 'tool_use') {
      task.phase = /search|web/i.test(data.tool_name) ? 'researching' : 'coding'
      addEvent(task, `Gemini usou ${shrink(data.tool_name)}.`)
    }
    if (data.type === 'message' && data.role === 'assistant' && data.content) {
      task.lastMessage = shrink(data.content, 500)
      addEvent(task, 'Gemini respondeu: ' + shrink(data.content, 140))
    }
    if (data.type === 'error') { task.failure = shrink(data.message || 'Gemini CLI relatou erro.', 500); addEvent(task, task.failure, 'error') }
    if (data.type === 'result') {
      if (data.response) task.lastMessage = shrink(data.response, 500)
      if (data.status === 'error' || data.error) task.failure = shrink(data.error?.message || 'Gemini CLI falhou.', 500)
      task.phase = 'finishing'
    }
    return
  }
  if (data.type === 'thread.started') {
    task.threadId = data.thread_id
  } else if (data.type === 'turn.started') {
    task.phase = 'thinking'
    addEvent(task, 'Codex iniciou a execução.')
  } else if (data.type === 'item.started' || data.type === 'item.updated' || data.type === 'item.completed') {
    const item = data.item || {}
    const verb = data.type === 'item.started' ? 'Iniciando' : data.type === 'item.completed' ? 'Concluiu' : 'Atualizando'
    if (item.type === 'command_execution') {
      task.phase = 'coding'
      if (data.type !== 'item.updated') addEvent(task, `${verb} comando: ${shrink(item.command)}`)
    } else if (item.type === 'file_change') {
      task.phase = 'coding'
      if (data.type !== 'item.updated') addEvent(task, `${verb} alteração de arquivos.`)
    } else if (item.type === 'agent_message' && data.type === 'item.completed') {
      task.lastMessage = shrink(item.text, 500)
      addEvent(task, 'Agente respondeu: ' + shrink(item.text, 140))
    } else if (item.type === 'web_search' && data.type !== 'item.updated') {
      task.phase = 'researching'
      addEvent(task, `${verb} pesquisa na web.`)
    } else if (item.type === 'reasoning' && data.type === 'item.started') {
      task.phase = 'thinking'
    }
  } else if (data.type === 'turn.completed') {
    task.usage = data.usage || null
    task.phase = 'finishing'
  } else if (data.type === 'turn.failed') {
    task.failure = shrink(data.error?.message || data.message || 'Codex não concluiu a tarefa.', 500)
    addEvent(task, task.failure, 'error')
  } else if (data.type === 'error') {
    // The CLI also emits recoverable connection errors before a successful retry.
    // Treat these as diagnostics until the process exit or a turn.failed event.
    addEvent(task, shrink(data.error?.message || data.message || 'Problema temporário no Codex.', 500), 'error')
  }
}

async function loadHistory() {
  try {
    const value = JSON.parse(await readFile(STORE, 'utf8'))
    tasks = Array.isArray(value) ? value.slice(0, MAX_TASKS).map(task =>
      task.status === 'running' ? { ...task, provider: task.provider || 'codex', status: 'interrupted', phase: 'idle' } : { ...task, provider: task.provider || 'codex' }
    ) : []
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Could not load history:', error.message)
  }
}

app.get('/api/state', (_req, res) => res.json(snapshot()))
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.write(`event: state\ndata: ${JSON.stringify(snapshot())}\n\n`)
  clients.add(res)
  const heartbeat = setInterval(() => res.write(': keepalive\n\n'), 20000)
  req.on('close', () => { clearInterval(heartbeat); clients.delete(res) })
})

app.post('/api/tasks', (req, res) => {
  const { prompt, agentId, workspace, provider: requestedProvider = 'codex' } = req.body || {}
  const provider = providers.find(item => item.id === requestedProvider)
  if (!provider) return res.status(400).json({ error: 'Motor de IA desconhecido.' })
  if (!provider.available) return res.status(503).json({ error: `${provider.name} não encontrado. Instale e autentique o CLI, depois reinicie o escritório.` })
  if (!ROLES.includes(agentId)) return res.status(400).json({ error: 'Agente desconhecido.' })
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > MAX_PROMPT) return res.status(400).json({ error: 'Tarefa vazia ou extensa demais.' })
  if (typeof workspace !== 'string' || workspace.length > 1000 || !isAbsolute(workspace)) return res.status(400).json({ error: 'Informe uma pasta de projeto com caminho absoluto.' })
  try {
    if (!statSync(workspace).isDirectory()) return res.status(400).json({ error: 'A pasta do projeto não é válida.' })
  } catch { return res.status(400).json({ error: 'Pasta do projeto não encontrada.' }) }
  let canonical
  try { canonical = realpathSync(workspace) }
  catch { return res.status(400).json({ error: 'Não foi possível acessar a pasta do projeto.' }) }
  if ([...active.values()].some(a => a.task.agentId === agentId)) return res.status(409).json({ error: 'Esse agente já está trabalhando.' })
  if ([...active.values()].some(a => foldersOverlap(canonical, a.canonical))) return res.status(409).json({ error: 'Já existe uma tarefa trabalhando nessa pasta (ou numa pasta dentro dela). Aguarde ou escolha outro projeto para evitar conflitos.' })

  const task = {
    id: randomUUID(), agentId, provider: provider.id, prompt: prompt.trim(), workspace, status: 'running', phase: 'thinking',
    createdAt: stamp(), updatedAt: stamp(), finishedAt: null, lastMessage: '', events: [], threadId: null, usage: null,
  }
  tasks.unshift(task)
  tasks = tasks.slice(0, MAX_TASKS)
  addEvent(task, `Tarefa enviada ao ${provider.name}.`)

  // Pass the human's prompt through stdin; never interpolate it into a shell command.
  const args = launchArgs(provider.id, workspace)
  if (provider.id === 'gemini') args.splice(1, 0, task.prompt)
  const command = provider.bin.endsWith('.js') ? process.execPath : provider.bin
  if (provider.bin.endsWith('.js')) args.unshift(provider.bin)
  let child
  try { child = spawn(command, args, { cwd: workspace, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }) }
  catch (error) {
    task.status = 'failed'; task.failure = error.message; addEvent(task, error.message, 'error')
    return res.status(500).json({ error: error.message })
  }

  active.set(task.id, { child, task, canonical })
  let buffer = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', chunk => {
    buffer += chunk
    if (buffer.length > 1024 * 1024) buffer = buffer.slice(-128 * 1024)
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      try { parseMessage(task, JSON.parse(line)) } catch { /* non-JSON diagnostics */ }
    }
  })
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-1200) })
  child.on('error', error => { task.failure = shrink(error.message, 400); addEvent(task, task.failure, 'error') })
  child.on('close', code => {
    active.delete(task.id)
    task.exitCode = code
    task.status = task.status === 'cancelled' ? 'cancelled' : code === 0 && !task.failure ? 'completed' : 'failed'
    task.phase = 'idle'
    task.finishedAt = stamp()
    if (task.status === 'failed') task.failure ||= shrink(task.events.filter(e => e.kind === 'error').at(-1)?.message || stderr || `${provider.name} saiu com código ${code}.`, 500)
    addEvent(task, task.status === 'completed' ? 'Tarefa concluída.' : task.status === 'cancelled' ? 'Tarefa cancelada.' : `Falha: ${task.failure}`, task.status === 'completed' ? 'success' : 'error')
  })
  child.stdin.on('error', () => {})
  child.stdin.end(provider.id === 'gemini' ? '' : task.prompt)
  res.status(201).json({ task })
})

app.post('/api/tasks/:id/cancel', (req, res) => {
  const running = active.get(req.params.id)
  if (!running) return res.status(404).json({ error: 'Tarefa em execução não encontrada.' })
  running.task.status = 'cancelled'
  addEvent(running.task, 'Cancelamento solicitado.')
  running.child.kill()
  res.json({ ok: true })
})

await loadHistory()
if (existsSync(join(ROOT, 'dist', 'index.html'))) {
  app.use(express.static(join(ROOT, 'dist')))
  app.get('/', (_req, res) => res.sendFile(join(ROOT, 'dist', 'index.html')))
}
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Agent Office API: http://127.0.0.1:${PORT}`)
  for (const provider of providers) console.log(`${provider.name}: ${provider.available ? 'detected' : 'not found'}`)
})
