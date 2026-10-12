import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
async function freePort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

test('agent CRUD supports independent teams, simultaneous edits and restart persistence', { timeout: 60000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'agent-office-roster-'))
  const port = await freePort()
  const base = `http://127.0.0.1:${port}`
  let child
  async function start() {
    child = spawn(process.execPath, [resolve('server/index.mjs')], {
      cwd: resolve('.'), env: { ...process.env, PORT: String(port), AGENT_OFFICE_DATA_DIR: directory },
      windowsHide: true, stdio: 'ignore',
    })
    for (let i = 0; i < 150; i++) {
      if (child.exitCode !== null) throw Error('Isolated API stopped unexpectedly')
      try { if ((await fetch(`${base}/api/state`, { signal: AbortSignal.timeout(500) })).ok) return } catch { /* waiting for the server */ }
      await delay(70)
    }
    throw Error('Isolated API did not start')
  }
  async function stop() {
    if (!child || child.exitCode !== null) return
    const stopped = once(child, 'exit')
    child.kill()
    await Promise.race([stopped, delay(5000).then(() => { throw Error('Isolated API could not stop') })])
  }
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, {
      method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, data: await response.json() }
  }
  const agent = index => ({ name: `Agent ${index}`, role: 'Security engineer', specialty: 'Security audit', department: 'security', color: '#aabbcc' })
  try {
    await start()
    assert.equal((await request('/api/state')).data.agents.length, 4, 'Existing users start with original four agents')
    const first = await request('/api/agents', 'POST', agent(0))
    assert.equal(first.status, 201)
    assert.equal((await request('/api/state')).data.agents.length, 5)
    assert.equal((await request('/api/agents', 'POST', { ...agent(1), department: 'unknown' })).status, 400)
    assert.equal((await request('/api/agents/absent', 'PUT', agent(1))).status, 404)
    const creates = await Promise.all(Array.from({ length: 20 }, (_, i) => request('/api/agents', 'POST', agent(i + 1))))
    assert.ok(creates.every(result => result.status === 201), 'Every simultaneous insertion must succeed')
    assert.equal((await request('/api/state')).data.agents.length, 25)
    const changed = await request(`/api/agents/${first.data.agent.id}`, 'PUT', { ...agent(0), name: 'Changed agent', department: 'data' })
    assert.equal(changed.status, 200)
    assert.equal(changed.data.agent.department, 'data')
    assert.equal((await request('/api/agents/absent', 'DELETE')).status, 404)
    await stop()
    const onDisk = JSON.parse(await readFile(join(directory, 'agents.json'), 'utf8'))
    assert.equal(onDisk.length, 25, 'All concurrent insertions must reach the disk')
    await start()
    const afterRestart = (await request('/api/state')).data.agents
    assert.equal(afterRestart.length, 25)
    assert.equal(afterRestart.find(item => item.id === first.data.agent.id)?.name, 'Changed agent')
    const removals = await Promise.all(afterRestart.map(item => request(`/api/agents/${item.id}`, 'DELETE')))
    assert.ok(removals.every(item => item.status === 200))
    assert.equal((await request('/api/state')).data.agents.length, 0)
    await stop()
    await start()
    assert.deepEqual((await request('/api/state')).data.agents, [], 'Zero-agent roster must persist after restart')
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'agents.json'), 'utf8')), [])
    console.log('Roster API: 4 → 5 → 25 → 0 agents; create/edit/delete and persistence verified')
  } finally {
    await stop()
    await rm(directory, { recursive: true, force: true })
  }
})
