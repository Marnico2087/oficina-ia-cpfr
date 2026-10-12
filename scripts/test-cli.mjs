import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { parseArgs, browserCommand } from '../bin/agent-office.mjs'

test('CLI accepts workspace and validates port without running a server', () => {
  const plain = parseArgs(['--no-open', '--port', '49150'])
  assert.equal(plain.open, false)
  assert.equal(plain.port, 49150)
  assert.equal(plain.workspace, process.cwd())
  assert.throws(() => parseArgs(['--port', 'abc']), /Port must/)
  assert.throws(() => parseArgs(['--port', '65536']), /Port must/)
  assert.throws(() => parseArgs(['--workspace']), /requires a directory/)
  assert.throws(() => parseArgs(['--other']), /Unknown argument/)
  assert.equal(parseArgs(['--help']).help, true)
})

test('CLI help/version do not require the server or a browser', () => {
  const help = execFileSync(process.execPath, ['bin/agent-office.mjs', '--help'], { encoding: 'utf8' })
  assert.match(help, /agent-office.*--port/)
  const version = execFileSync(process.execPath, ['bin/agent-office.mjs', '--version'], { encoding: 'utf8' })
  assert.match(version, /^\d+\.\d+\.\d+\s*$/)
  assert.equal(browserCommand('http://127.0.0.1:4300/', 'darwin').command, 'open')
})
