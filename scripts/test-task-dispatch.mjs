import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const sleep = ms => new Promise(done => setTimeout(done, ms))

test('task dispatch passes the agent profile and preserves the human request for every CLI', { timeout: 60000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-dispatch-'))
  const workspace = join(root, 'project')
  const data = join(root, 'data')
  const captures = join(root, 'captures')
  const fakeCli = join(root, 'fake-provider.js')
  await Promise.all([mkdir(workspace), mkdir(captures)])
  await writeFile(fakeCli, [
    "const { writeFileSync } = require('node:fs')",
    "const { join } = require('node:path')",
    'const args = process.argv.slice(2)',
    "const provider = args.includes('exec') ? 'codex' : args.includes('--print') ? 'claude' : 'gemini'",
    "let incoming = ''",
    "process.stdin.setEncoding('utf8')",
    "process.stdin.on('data', part => incoming += part)",
    "process.stdin.on('end', () => {",
    "  const prompt = provider === 'gemini' ? args[args.indexOf('-p') + 1] : incoming",
    "  writeFileSync(join(process.env.AGENT_OFFICE_FAKE_CAPTURE, provider + '.json'), JSON.stringify({ args, prompt }))",
    "  process.stdout.write(JSON.stringify({ type: provider === 'codex' ? 'turn.completed' : 'result' }) + '\\n')",
    '})',
  ].join('\n'))

  const listener = createServer()
  listener.listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(done => listener.close(done))
  const base = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, [resolve('server/index.mjs')], {
    cwd: resolve('.'), windowsHide: true, stdio: 'ignore',
    env: {
      ...process.env, PORT: String(port), AGENT_OFFICE_DATA_DIR: data,
      CODEX_BIN: fakeCli, CLAUDE_BIN: fakeCli, GEMINI_BIN: fakeCli,
      AGENT_OFFICE_FAKE_CAPTURE: captures,
    },
  })
  const request = async (path, method = 'GET', body) => {
    const response = await fetch(base + path, {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    const result = await response.json()
    assert.ok(response.ok, `${method} ${path}: ${JSON.stringify(result)}`)
    return result
  }
  try {
    let ready = false
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error('Isolated API exited')
      try { ready = (await fetch(`${base}/api/state`, { signal: AbortSignal.timeout(500) })).ok } catch { /* start-up */ }
      if (ready) break
      await sleep(70)
    }
    assert.ok(ready, 'Isolated API did not start')
    const state = await request('/api/state')
    assert.ok(state.providers.every(provider => provider.available), 'Mock CLIs must be available')
    const existing = state.agents[0]
    const profile = { ...existing, name: 'Review Specialist', role: 'Visual QA', specialty: 'Animation posture', department: 'quality' }
    await request(`/api/agents/${existing.id}`, 'PUT', profile)
    const humanPrompt = 'Review the seating transition.\nDo not alter the live project.'
    for (const provider of ['codex', 'claude', 'gemini']) {
      const { task } = await request('/api/tasks', 'POST', { agentId: existing.id, provider, workspace, prompt: humanPrompt })
      assert.equal(task.prompt, humanPrompt, 'History must retain the original task')
      let completed = false
      for (let i = 0; i < 100; i++) {
        const latest = (await request('/api/state')).tasks.find(item => item.id === task.id)
        if (latest.status !== 'running') {
          assert.equal(latest.status, 'completed', `${provider} mock must complete successfully`)
          completed = true
          break
        }
        await sleep(40)
      }
      assert.ok(completed, `${provider} job did not finish`)
      const capture = JSON.parse(await readFile(join(captures, provider + '.json'), 'utf8'))
      for (const field of ['Review Specialist', 'Visual QA', 'Animation posture', 'quality', humanPrompt]) {
        assert.ok(capture.prompt.includes(field), `${provider} did not receive ${field}`)
      }
    }
  } finally {
    if (server.exitCode === null) {
      const done = once(server, 'exit')
      server.kill()
      await Promise.race([done, sleep(5000).then(() => { throw new Error('Isolated API could not stop') })])
    }
    await rm(root, { force: true, recursive: true })
  }
})
