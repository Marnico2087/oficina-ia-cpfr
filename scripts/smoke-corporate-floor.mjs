// Isolated rendered audit; fixture data is synthetic and no AI task is launched.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'
import { DEFAULT_AGENTS, makeAgent } from '../server/agents.mjs'

const chrome = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome')
const sleep = ms => new Promise(done => setTimeout(done, ms))
const root = await mkdtemp(join(tmpdir(), 'office-floor-audit-'))
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox', '--disable-extensions', '--enable-webgl'] })
const evidence = []
let server
try {
  await mkdir('work', { recursive: true })
  for (const count of process.env.OFFICE_FLOOR_COUNTS ? process.env.OFFICE_FLOOR_COUNTS.split(',').map(Number) : [0, 1, 4, 20, 100, 1000]) {
    console.log(`Checking rendered floor: ${count} agents`)
    const directory = join(root, String(count))
    await mkdir(directory)
    const roster = Array.from({ length: count }, (_, i) => i < 4 ? DEFAULT_AGENTS[i] : makeAgent({
      name: `Agent ${i}`, role: 'Developer', specialty: 'Safe visual fixture', color: ['#5999c1', '#73bda0', '#cc9f75'][i % 3],
      department: ['engineering', 'quality', 'research', 'operations'][i % 4],
    }, `audit-${i}`))
    await writeFile(join(directory, 'agents.json'), JSON.stringify(roster))
    const listener = createServer().listen(0, '127.0.0.1')
    await once(listener, 'listening')
    const port = listener.address().port
    await new Promise(done => listener.close(done))
    const origin = `http://127.0.0.1:${port}`
    server = spawn(process.execPath, [resolve('server/index.mjs')], { cwd: resolve('.'), windowsHide: true, stdio: 'ignore',
      env: { ...process.env, PORT: String(port), AGENT_OFFICE_DATA_DIR: directory } })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      try { ready = (await fetch(origin + '/api/state', { signal: AbortSignal.timeout(500) })).ok } catch { /* startup */ }
      if (ready) break
      assert.equal(server.exitCode, null, 'isolated API exited before readiness')
      await sleep(100)
    }
    assert.ok(ready, 'API startup timed out')
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    await page.evaluateOnNewDocument((fixture, size) => {
      localStorage.setItem('agent-office-language', 'en')
      localStorage.setItem('agent-office-public-demo-roster-v1', JSON.stringify(fixture))
      localStorage.setItem('agent-office-appearance-v1', JSON.stringify({ motion: size === 4 ? 'lively' : 'off', theme: 'daylight', spacing: 'regular' }))
    }, roster, count)
    await page.setViewport({ width: 1440, height: 960 })
    await page.goto(origin, { waitUntil: 'domcontentloaded' })
    try {
      await page.waitForSelector('canvas', { timeout: 20000 })
      await page.waitForFunction(expected => document.querySelectorAll('.scene-phase-label').length === Math.min(expected, 50), { timeout: 20000 }, count)
      await page.waitForSelector('[data-layout-transition="ready"]', { timeout: 10000 })
    } catch (error) {
      await page.screenshot({ path: resolve('work/floor-render-failure.png'), fullPage: true })
      const snapshot = await page.evaluate(() => ({ labels: document.querySelectorAll('.scene-phase-label').length, cards: document.querySelectorAll('.crew-card').length, text: document.body.innerText.slice(0, 1200) }))
      throw new Error(`${count} agent render failed: ${JSON.stringify({ snapshot, errors })}`, { cause: error })
    }
    await sleep(1300)
    if (count === 1) { await page.click('.scene-overview-btn'); await sleep(350) }
    const artifact = `floor-${count}-desktop.png`
    await (await page.$('.scene-frame')).screenshot({ path: resolve('work', artifact) })
    const webgl = await page.$eval('canvas', canvas => { const gl = canvas.getContext('webgl2'); return Boolean(gl && !gl.isContextLost()) })
    assert.equal(webgl, true, `WebGL failed at ${count} agents`)
    const pods = await page.$$eval('.scene-sector-label', labels => labels.map(label => label.dataset.sector))
    assert.equal(new Set(pods).size, pods.length, 'pod labels must have unique keys even with repeated departments')
    if (count === 100) {
      await page.$$eval('.crew-card', cards => cards.at(-1).click())
      await page.waitForSelector('.scene-phase-label[data-agent="audit-99"]')
      await sleep(750)
      await (await page.$('.scene-frame')).screenshot({ path: resolve('work/floor-100-focus.png') })
    }
    if (count === 4) {
      await page.setViewport({ width: 390, height: 844 })
      await sleep(700)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), 'mobile layout overflows horizontally')
      await page.screenshot({ path: resolve('work/floor-4-mobile.png'), fullPage: true })
    }
    // Both modes must use their own roster; Live has no running tasks in this fixture.
    await page.waitForSelector('.api-badge.on')
    await page.click('button.mode-btn')
    await page.waitForSelector('.mode-btn.live')
    await page.waitForFunction(expected => document.querySelectorAll('.crew-card').length === expected &&
      [...document.querySelectorAll('.scene-phase-label')].every(label => label.dataset.pose === 'idle'), { timeout: 20000 }, count)
    if (count === 4) {
      await page.evaluate(() => {
        window.__floorTransitions = []
        window.__floorSampler = setInterval(() => window.__floorTransitions.push({
          phase: document.querySelector('.office-3d-shell')?.dataset.layoutTransition,
          opacity: Number(getComputedStyle(document.querySelector('canvas')).opacity),
        }), 15)
      })
      const edit = async (agent, role) => {
        const response = await fetch(`${origin}/api/agents/${agent.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...agent, role }) })
        assert.ok(response.ok, 'synthetic role update failed')
      }
      await edit(roster[1], 'Team Lead')
      await sleep(90)
      await edit(roster[0], 'Developer')
      // Equivalent SSE roster snapshots must not restart closing/opening timers.
      for (let revision = 0; revision < 8; revision++) {
        await sleep(100)
        await edit({ ...roster[0], specialty: `Metadata revision ${revision}` }, 'Developer')
        if (revision >= 5) assert.equal(await page.$eval('.office-3d-shell', element => element.dataset.layoutTransition), 'ready',
          'same-geometry snapshots must allow the scene to finish opening while updates continue')
      }
      await page.waitForSelector('[data-layout-transition="ready"]', { timeout: 10000 })
      await sleep(350)
      const transitions = await page.evaluate(() => { clearInterval(window.__floorSampler); return window.__floorTransitions })
      assert.ok(transitions.some(item => item.phase === 'closing' && item.opacity < .15), 'geometry changes must fade before replacing furniture and actors')
      assert.ok(transitions.some(item => item.phase === 'opening'), 'latest geometry must reopen after rapid edits')
      assert.equal(transitions.at(-1).phase, 'ready')
      assert.deepEqual(errors, [], 'rapid layout reconfiguration must not break rendering')
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
      await page.waitForSelector('[data-office-motion="off"]')
      await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])
      await page.waitForSelector('[data-office-motion="lively"]')
    }
    assert.deepEqual(errors, [], `Browser errors at ${count}: ${errors.join(' | ')}`)
    evidence.push({ agents: count, detailed: Math.min(count, 50), pods: pods.length, webgl, errors: 0, artifact })
    await page.close()
    const exit = once(server, 'exit'); server.kill(); await Promise.race([exit, sleep(5000)])
    server = undefined
  }
  await writeFile('work/floor-audit-evidence.json', JSON.stringify({ evidence }, null, 2))
  console.log(JSON.stringify({ corporateFloor: 'passed', evidence }))
} finally {
  const watchdog = setTimeout(() => browser.process()?.kill(), 7000)
  try { await browser.close() } finally { clearTimeout(watchdog) }
  if (server?.exitCode === null) { const exit = once(server, 'exit'); server.kill(); await Promise.race([exit, sleep(5000)]) }
  await rm(root, { recursive: true, force: true })
}
