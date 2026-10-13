const net = require('node:net')
const http = require('node:http')
const { statSync } = require('node:fs')
const { delimiter, dirname, isAbsolute, join, resolve } = require('node:path')

function file(path) { try { return statSync(path).isFile() } catch { return false } }
function resolveLaunch(raw, env = process.env, platform = process.platform) {
  if (typeof raw !== 'string' || !raw.trim() || /[\r\n\0]/.test(raw)) throw new Error('Configure a CLI executable path, without shell arguments.')
  const folders = (env.PATH || env.Path || '').split(delimiter).filter(path => isAbsolute(path))
  let command = isAbsolute(raw) ? raw : folders.flatMap(folder =>
    (platform === 'win32' ? [raw, raw + '.exe', raw + '.cmd'] : [raw]).map(name => join(folder, name))).find(file)
  if (!command || !file(command)) throw new Error('Agent Office CLI was not found. Install the prebuilt CLI or configure its absolute executable path.')
  if (/\.(cmd|bat)$/i.test(command)) {
    const entry = join(dirname(command), 'node_modules', 'agent-office', 'bin', 'agent-office.mjs')
    if (!file(entry)) throw new Error('This shell wrapper has no Agent Office Node entrypoint. Configure the absolute CLI .mjs or executable path.')
    command = entry
  }
  if (/\.[cm]?js$/i.test(command)) {
    const node = folders.map(folder => join(folder, platform === 'win32' ? 'node.exe' : 'node')).find(file)
    if (!node) throw new Error('Node.js was not found on PATH. Install Node.js and restart VS Code.')
    return { command: node, args: [command] }
  }
  return { command, args: [] }
}

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

async function waitUntilReady(port, child, timeoutMs = 20000, expected = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.agentOfficeError) throw child.agentOfficeError
    if (child.exitCode != null || child.signalCode != null || child.killed) throw new Error('Agent Office process stopped during startup.')
    const ok = await new Promise(done => {
      let settled = false
      const finish = value => { if (!settled) { settled = true; clearTimeout(timer); done(value) } }
      const timer = setTimeout(() => { req.destroy(); finish(false) }, Math.min(500, Math.max(1, deadline - Date.now())))
      const req = http.get(`http://127.0.0.1:${port}/api/state`, res => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', part => { body += part; if (body.length > 4 * 1024 * 1024) { req.destroy(); finish(false) } })
        res.on('error', () => finish(false))
        res.on('end', () => {
          try {
            const state = JSON.parse(body)
            finish(res.statusCode === 200 && state.connected === true && Array.isArray(state.agents) && Array.isArray(state.tasks) &&
              Array.isArray(state.providers) && (!expected.instanceId || state.instanceId === expected.instanceId) &&
              (!expected.folder || (typeof state.defaultWorkspace === 'string' && resolve(state.defaultWorkspace) === resolve(expected.folder))))
          } catch { finish(false) }
        })
      })
      req.on('error', () => finish(false))
    })
    if (ok && !child.agentOfficeError && child.exitCode == null && child.signalCode == null && !child.killed) return
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error(`Agent Office did not start within ${timeoutMs / 1000} seconds. Check the Output panel for details.`)
}

module.exports = { freePort, waitUntilReady, resolveLaunch }
