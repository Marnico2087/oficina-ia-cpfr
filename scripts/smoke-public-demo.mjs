// Proves the public website works without any Agent Office server or AI CLI.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer } from 'node:net'
import { resolve } from 'node:path'
import { mkdir } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'
import { PNG } from 'pngjs'
import { DEFAULT_AGENTS } from '../server/agents.mjs'

const chrome = process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome')
const listener = createServer()
listener.listen(0, '127.0.0.1')
await once(listener, 'listening')
const port = listener.address().port
await new Promise(done => listener.close(done))
const origin = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), 'preview', '--mode', 'public-demo', '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: resolve('.'), windowsHide: true, stdio: 'ignore',
})
const sleep = ms => new Promise(done => setTimeout(done, ms))
const errors = []
const apiRequests = []
const failedResources = []
let browser

try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw Error('Preview server exited')
    try { ready = (await fetch(`${origin}/agent-office/`, { signal: AbortSignal.timeout(500) })).ok } catch { /* startup */ }
    if (ready) break
    await sleep(100)
  }
  assert.ok(ready, 'Static preview must start')
  browser = await puppeteer.launch({ executablePath: chrome, headless: true,
    args: ['--no-sandbox', '--disable-extensions', '--enable-webgl', '--no-first-run', '--no-default-browser-check',
      ...(process.env.SOFTWARE_RENDER === '1' ? ['--use-gl=angle', '--use-angle=swiftshader'] : [])] })
  const page = await browser.newPage()
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  page.on('request', req => { if (new URL(req.url()).pathname.startsWith('/api/')) apiRequests.push(req.url()) })
  page.on('response', response => { if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`) })
  await page.setViewport({ width: 1440, height: 960 })
  await page.evaluateOnNewDocument(defaultAgents => {
    localStorage.setItem('agent-office-language', 'en')
    // Server fixtures no longer populate Demo. Seed this visitor's isolated sample roster explicitly.
    if (localStorage.getItem('agent-office-public-demo-roster-v1') === null) {
      localStorage.setItem('agent-office-public-demo-roster-v1', JSON.stringify(defaultAgents))
    }
  }, DEFAULT_AGENTS)
  await page.goto(`${origin}/agent-office/`, { waitUntil: 'domcontentloaded' })
  try { await page.waitForSelector('canvas', { timeout: 25000 }) }
  catch (error) {
    console.error('Demo load failed', JSON.stringify({ url: page.url(), title: await page.title(), text: (await page.$eval('body', node => node.innerText).catch(() => ''))?.slice(0, 1400), browserErrors: errors, failedResources, apiRequests }))
    throw error
  }
  const count = n => page.waitForFunction(expected => document.querySelectorAll('.crew-card').length === expected, { timeout: 25000 }, n)
  await count(4)
  assert.equal(await page.$eval('.mode-btn', el => el.tagName), 'SPAN', 'Static demo must not allow live mode')
  assert.ok((await page.$eval('.topbar', el => el.innerText)).includes('Demo'), 'Public preview needs clear demo status')

  await page.click('[aria-label="Agent team"]')
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Add agent'))?.click())
  await page.waitForSelector('#agent-name')
  assert.equal(await page.$eval('#agent-name', el => el === document.activeElement), true, 'Agent dialog needs initial focus')
  await page.type('#agent-name', 'Visitor')
  await page.type('#agent-role', 'Security engineer')
  await page.type('#agent-specialty', 'Inspect a test environment')
  assert.equal(await page.$eval('#agent-department', el => el.value), 'security')
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Save agent'))?.click())
  await page.waitForFunction(() => document.querySelectorAll('.agent-card').length === 5)
  await page.click('[aria-label="Edit agent Visitor"]')
  await page.waitForSelector('#agent-department')
  await page.select('#agent-department', 'research')
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Save agent'))?.click())
  await page.waitForFunction(() => !document.querySelector('#agent-department'))
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('agent-office-public-demo-roster-v1')))
  assert.equal(saved.length, 5)
  assert.equal(saved.find(a => a.name === 'Visitor')?.department, 'research')

  await page.click('[aria-label="Settings"]')
  await page.select('#office-theme', 'warm')
  assert.equal(await page.$('#path'), null, 'Public preview must hide real workspace paths')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.click('[aria-label="Agent team"]')
  await page.waitForFunction(() => document.querySelectorAll('.agent-card').length === 5)
  await page.click('[aria-label="Edit agent Visitor"]')
  assert.equal(await page.$eval('#agent-department', el => el.value), 'research')
  await page.click('[aria-label="Close"]')
  await page.click('[aria-label="Settings"]')
  assert.equal(await page.$eval('#office-theme', el => el.value), 'warm')

  await page.click('[aria-label="Office studio"]')
  await count(5)
  await page.waitForFunction(() => document.querySelectorAll('.scene-phase-label').length === 5, { timeout: 15000 })
  await sleep(2000)
  const scene = PNG.sync.read(await (await page.$('.scene-frame')).screenshot({ type: 'png' }))
  const sceneColors = new Set()
  for (let y = Math.floor(scene.height * .24); y < Math.floor(scene.height * .8); y += 7) {
    for (let x = Math.floor(scene.width * .14); x < Math.floor(scene.width * .86); x += 7) {
      const i = (y * scene.width + x) * 4
      sceneColors.add(`${scene.data[i] >> 4}:${scene.data[i + 1] >> 4}:${scene.data[i + 2] >> 4}`)
    }
  }
  assert.ok(sceneColors.size > 20, `3D office must have visible geometry (${sceneColors.size} sampled colors)`)
  await mkdir('work', { recursive: true })
  await page.screenshot({ path: resolve('work/public-demo.png'), fullPage: true })
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Create a task'))?.click())
  await page.waitForSelector('#prompt')
  assert.equal(await page.$eval('#prompt', el => el === document.activeElement), true, 'Task dialog needs initial focus')
  assert.equal(await page.$('#mission-dir'), null, 'Demo must not request a filesystem path')
  await page.type('#prompt', 'Test preview task')
  await page.evaluate(() => [...document.querySelectorAll('button')].find(el => el.textContent?.includes('Launch task'))?.click())
  await page.waitForFunction(() => document.body.textContent.includes('Demo task started'))
  await sleep(300)
  // Corrupt browser data must recover without consulting a private or real roster.
  await page.evaluate(() => localStorage.setItem('agent-office-public-demo-roster-v1', '{broken'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await count(4)
  await page.evaluate(() => localStorage.setItem('agent-office-public-demo-roster-v1', '[]'))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await count(0)
  await page.click('.intro .primary-btn')
  await page.waitForSelector('.team-intro')
  assert.equal(await page.$('dialog[open]'), null, 'Empty demo roster must ask for an agent first')
  assert.deepEqual(apiRequests, [], 'Public demo must make zero API calls')
  assert.deepEqual(errors, [], `Browser errors: ${errors.join(' | ')}`)
  console.log(JSON.stringify({ publicDemo: 'passed', agents: 5, persistedEdits: true, persistedAppearance: true,
    simulatedTask: true, corruptStorageRecovery: true, emptyRoster: true, modalFocus: true, apiCalls: apiRequests.length, consoleErrors: errors.length }))
} finally {
  if (browser) await browser.close()
  if (server.exitCode === null) { const done = once(server, 'exit'); server.kill(); await Promise.race([done, sleep(5000)]) }
}
