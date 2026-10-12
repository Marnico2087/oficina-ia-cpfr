// Visual regression capture with an isolated roster. Never starts AI tasks.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import puppeteer from 'puppeteer-core'

const chrome = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome')
const dataDir = await mkdtemp(join(tmpdir(), 'agent-office-avatar-'))
const listener = createServer()
listener.listen(0, '127.0.0.1')
await once(listener, 'listening')
const port = listener.address().port
await new Promise(done => listener.close(done))
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [resolve('server/index.mjs')], {
  cwd: resolve('.'), env: { ...process.env, PORT: String(port), AGENT_OFFICE_DATA_DIR: dataDir }, windowsHide: true, stdio: 'ignore',
})
const sleep = ms => new Promise(done => setTimeout(done, ms))
const errors = []
let browser

try {
  let ready = false
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw Error('Isolated server failed to start')
    try { ready = (await fetch(origin + '/api/state', { signal: AbortSignal.timeout(500) })).ok } catch { /* startup */ }
    if (ready) break
    await sleep(100)
  }
  assert.ok(ready, 'Isolated server timeout')
  browser = await puppeteer.launch({ executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--disable-extensions', '--enable-webgl', '--no-first-run', '--no-default-browser-check',
      ...(process.env.SOFTWARE_RENDER === '1' ? ['--use-gl=angle', '--use-angle=swiftshader'] : [])] })
  const page = await browser.newPage()
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewport({ width: 1440, height: 960 })
  await page.evaluateOnNewDocument(() => localStorage.setItem('agent-office-language', 'en'))
  await page.goto(origin, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelectorAll('.crew-card').length === 4)
  await mkdir('work', { recursive: true })

  const focus = async index => {
    await page.$$eval('.crew-card', (cards, number) => cards[number]?.click(), index)
    await sleep(450)
    const frame = await page.$('.scene-frame')
    const rect = await frame.boundingBox()
    assert.ok(rect, 'Office frame must be visible')
    await page.mouse.move(rect.x + rect.width * .52, rect.y + rect.height * .53)
    for (let i = 0; i < 8; i++) await page.mouse.wheel({ deltaY: -240 })
    await sleep(450)
    return frame
  }
  const capture = async (index, label, { face = false } = {}) => {
    const frame = await focus(index)
    if (face) {
      const rect = await frame.boundingBox()
      assert.ok(rect, 'Office frame must remain visible')
      const x = rect.x + rect.width * .5
      const y = rect.y + rect.height * .56
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + rect.height * .43, y - rect.height * .14, { steps: 24 })
      await page.mouse.up()
      await sleep(650)
    }
    await frame.screenshot({ path: resolve(`work/avatar-${label}.png`) })
  }

  await capture(1, 'working-early')
  await sleep(2300)
  await capture(1, 'working-seated')
  await page.addStyleTag({ content: '.scene-phase-label, .scene-sector-label { visibility: hidden!important; }' })
  await capture(1, 'working-close-unobstructed')
  await capture(0, 'thinking-close')
  await capture(0, 'thinking-front', { face: true })
  await capture(2, 'standing-idle')
  await sleep(14700)
  await capture(2, 'idle-after-walking')
  const webgl = await page.$eval('canvas', el => {
    const context = el.getContext('webgl2')
    return { active: Boolean(context), lost: context?.isContextLost() }
  })
  assert.deepEqual(errors, [], `Browser errors: ${errors.join(' | ')}`)
  assert.ok(webgl.active && !webgl.lost, 'WebGL context must remain available')
  console.log(JSON.stringify({ avatarVisual: 'passed', captures: ['working-early', 'working-seated', 'working-close-unobstructed', 'thinking-close', 'thinking-front', 'standing-idle', 'idle-after-walking'], webgl, consoleErrors: errors.length }))
} finally {
  if (browser) {
    const watchdog = setTimeout(() => browser.process()?.kill(), 7000)
    try { await browser.close() } finally { clearTimeout(watchdog) }
  }
  if (server.exitCode === null) { const exit = once(server, 'exit'); server.kill(); await Promise.race([exit, sleep(5000)]) }
  await rm(dataDir, { recursive: true, force: true })
}
