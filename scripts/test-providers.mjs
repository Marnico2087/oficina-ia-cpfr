import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join } from 'node:path'
import { discoverProviders, foldersOverlap, launchArgs } from '../server/providers.mjs'

test('supports three CLI choices and safe launch arguments', () => {
  assert.equal(launchArgs('codex', '/projects/a')[0], 'exec')
  assert.ok(launchArgs('claude', '/projects/a').includes('stream-json'))
  assert.ok(launchArgs('gemini', '/projects/a').includes('auto_edit'))
  assert.throws(() => launchArgs('other', '/projects/a'))
})

test('rejects concurrent tasks in matching or nested folders', () => {
  const root = join(tmpdir(), 'case-project')
  assert.equal(foldersOverlap(root, root), true)
  assert.equal(foldersOverlap(root, join(root, 'src')), true)
  assert.equal(foldersOverlap(join(root, 'src'), root), true)
  assert.equal(foldersOverlap(root, root + '-another'), false)
  assert.equal(foldersOverlap('C:\\Projects\\Demo', 'c:\\projects\\demo', 'win32'), true)
})

test('detects CLI binaries without invoking a shell', async () => {
  const root = await mkdtemp(join(tmpdir(), 'agent-office-providers-'))
  try {
    await writeFile(join(root, 'codex.exe'), '')
    await writeFile(join(root, 'claude.cmd'), '')
    const claude = join(root, 'node_modules', '@anthropic-ai', 'claude-code', 'bin')
    await mkdir(claude, { recursive: true })
    await writeFile(join(claude, 'claude.exe'), '')
    const list = discoverProviders({ PATH: root + delimiter }, 'win32')
    assert.equal(list.find(item => item.id === 'codex').available, true)
    assert.equal(list.find(item => item.id === 'claude').available, true)
    assert.equal(list.find(item => item.id === 'gemini').available, false)
    assert.equal(list.find(item => item.id === 'claude').bin, join(claude, 'claude.exe'))
  } finally { await rm(root, { recursive: true, force: true }) }
})
