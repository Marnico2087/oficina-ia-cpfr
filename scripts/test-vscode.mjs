import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import http from 'node:http'
const require = createRequire(import.meta.url)
const { freePort, waitUntilReady } = require('../vscode-extension/runtime.cjs')
const { activate, deactivate } = require('../vscode-extension/extension.cjs')

test('VS Code extension contributes the command and workspace configuration', () => {
  const manifest = require('../vscode-extension/package.json')
  assert.ok(manifest.contributes.commands.some(item => item.command === 'agent-office.open'))
  assert.ok(manifest.contributes.configuration.properties['agentOffice.command'])
})

test('VS Code command refuses opening without a workspace folder', async () => {
  let command
  const errors = []
  const vscode = {
    window: { createOutputChannel: () => ({ append() {}, appendLine() {}, show() {}, dispose() {} }), showErrorMessage: x => errors.push(x) },
    workspace: { workspaceFolders: [] },
    commands: { registerCommand(_name, handler) { command = handler; return { dispose() {} } } },
  }
  activate({ subscriptions: [] }, vscode)
  await command()
  assert.match(errors[0], /Open a project folder/)
  deactivate()
})

test('IDE local port probe awaits the real API', async () => {
  const port = await freePort()
  const server = http.createServer((req, res) => {
    res.writeHead(req.url === '/api/state' ? 200 : 404)
    res.end()
  })
  await new Promise(resolve => server.listen(port, '127.0.0.1', resolve))
  try {
    await waitUntilReady(port, { exitCode: null, signalCode: null, killed: false }, 800)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
