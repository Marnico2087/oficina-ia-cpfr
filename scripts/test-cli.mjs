import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseArgs, browserCommand } from '../bin/agent-office.mjs'
import { auditPublic } from './check-public.mjs'

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

test('CLI refuses files as workspaces and canonicalizes directory aliases', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-cli-'))
  try {
    const file = join(root, 'file.txt'); await writeFile(file, 'fixture')
    assert.throws(() => parseArgs(['--workspace', file]), /not a directory/)
    assert.equal(parseArgs(['--workspace', join(root, '.')]).workspace, root)
    assert.throws(() => parseArgs(['--port']), /Port must/)
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'agent-office-cli-'))); await rm(root, { recursive: true, force: true }) }
})

test('public checker scans staged, unstaged, untracked source and env examples while excluding private ignored data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-public-'))
  const git = args => execFileSync('git', args, { cwd: root, stdio:'pipe' })
  const fakeToken = 'ghp_' + 'x'.repeat(40)
  try {
    git(['init', '--quiet'])
    await writeFile(join(root, '.gitignore'), '.local/\n.env\n')
    await writeFile(join(root, 'source.mjs'), '// safe fixture\n')
    git(['add', '.gitignore', 'source.mjs'])
    await writeFile(join(root, 'source.mjs'), fakeToken)
    await writeFile(join(root, 'untracked.mjs'), fakeToken)
    await writeFile(join(root, '.env.example'), 'ACCESS_TOKEN=' + fakeToken)
    await writeFile(join(root, '.env'), fakeToken)
    let report = auditPublic(root)
    assert.ok(report.errors.some(error => error.startsWith('source.mjs:') && error.includes('working tree')))
    assert.ok(report.errors.some(error => error.startsWith('untracked.mjs:')))
    assert.ok(report.errors.some(error => error.startsWith('.env.example:')))
    assert.ok(!report.paths.includes('.env'))
    git(['add', 'source.mjs'])
    await writeFile(join(root, 'source.mjs'), '// safe fixture\n')
    report = auditPublic(root)
    assert.ok(report.errors.some(error => error.startsWith('source.mjs:') && error.includes('index')))
    assert.ok(auditPublic(root, true).errors.some(error => error.includes('not clean')))
  } finally { assert.ok(root.startsWith(join(tmpdir(), 'agent-office-public-'))); await rm(root, { recursive:true,force:true }) }
})

test('CLI help/version do not require the server or a browser', () => {
  const help = execFileSync(process.execPath, ['bin/agent-office.mjs', '--help'], { encoding: 'utf8' })
  assert.match(help, /agent-office.*--port/)
  const version = execFileSync(process.execPath, ['bin/agent-office.mjs', '--version'], { encoding: 'utf8' })
  assert.match(version, /^\d+\.\d+\.\d+\s*$/)
  assert.equal(browserCommand('http://127.0.0.1:4300/', 'darwin').command, 'open')
})
