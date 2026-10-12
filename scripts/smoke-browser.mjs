import puppeteer from 'puppeteer-core'
import { strict as assert } from 'node:assert'
import { PNG } from 'pngjs'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const chrome = process.env.CHROME_BIN ||
  (process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '/usr/bin/google-chrome')
if (!existsSync(chrome)) throw new Error('Chrome not found. Set CHROME_BIN to its executable.')
const url = process.env.OFFICE_URL || 'http://127.0.0.1:5173/'
const screenshot = process.env.SCREENSHOT_PATH || resolve('screenshots', 'office-smoke.png')
mkdirSync(dirname(screenshot), { recursive: true })
const browser = await puppeteer.launch({
  executablePath: chrome, headless: process.env.CHROME_HEADED !== '1',
  args: ['--no-first-run', '--no-default-browser-check', '--disable-extensions', '--enable-webgl', '--no-sandbox', ...(process.env.SOFTWARE_RENDER === '1' ? ['--use-gl=angle', '--use-angle=swiftshader'] : [])],
  timeout: 30_000,
})

const errors = []
try {
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    if (!localStorage.getItem('agent-office-language')) localStorage.setItem('agent-office-language', 'en')
  })
  page.on('pageerror', err => errors.push(err.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30_000 })
  await page.waitForSelector('canvas', { timeout: 15_000 })
  await new Promise(resolve => setTimeout(resolve, 2500))
  assert.match(await page.title(), /Agent Office/i)
  assert.match(await page.$eval('h1', el => el.textContent), /Mission control/i)
  const renderState = await page.evaluate(() => {
    const canvas = document.querySelector('canvas')
    const gl = canvas?.getContext('webgl2')
    return {
      canvas: Boolean(canvas), webgl: Boolean(gl),
      width: canvas?.width, height: canvas?.height,
      canvasRect: canvas?.getBoundingClientRect().toJSON(),
      webglError: gl?.getError(), contextLost: gl?.isContextLost(),
      drawingBuffer: gl ? [gl.drawingBufferWidth, gl.drawingBufferHeight] : null,
      avatars: document.querySelectorAll('.crew-card').length,
    }
  })
  assert.equal(renderState.avatars, 4, 'Expected four characters in the team strip')
  assert.equal(renderState.webgl, true, 'WebGL 2 unavailable')
  assert.equal(renderState.contextLost, false, 'WebGL context was lost')
  assert.ok(renderState.drawingBuffer?.[0] > 0, 'WebGL drawing buffer unavailable')
  // Read the browser's composed screenshot, not the WebGL buffer between frames.
  const sceneElement = await page.$('.scene-frame')
  const sceneImage = PNG.sync.read(await sceneElement.screenshot({ type: 'png' }))
  let lit = 0, dark = 0, scanned = 0
  for (let y = Math.floor(sceneImage.height * .2); y < Math.floor(sceneImage.height * .85); y += 4) {
    for (let x = Math.floor(sceneImage.width * .1); x < Math.floor(sceneImage.width * .9); x += 4) {
      const i = (y * sceneImage.width + x) * 4
      const peak = Math.max(sceneImage.data[i], sceneImage.data[i + 1], sceneImage.data[i + 2])
      if (peak > 90) lit++
      if (peak < 65) dark++
      scanned++
    }
  }
  assert.ok(lit > scanned * .02 && dark > scanned * .10,
    `3D scene appears empty (lit=${lit}, dark=${dark}, samples=${scanned})`)
  renderState.visualSample = { lit, dark, scanned }
  await page.screenshot({ path: screenshot, fullPage: true })

  async function click(text) {
    const clicked = await page.evaluate(label => {
      const button = [...document.querySelectorAll('button')].find(el => el.textContent?.includes(label))
      button?.click()
      return Boolean(button)
    }, text)
    assert.equal(clicked, true, 'Button missing: ' + text)
  }
  await click('New task')
  await page.waitForSelector('[role=dialog]')
  assert.match(await page.$eval('[role=dialog] h2', el => el.textContent), /Create a task/)
  await page.$eval('[aria-label="Close"]', el => el.click())
  await click('Activity & tasks')
  assert.match(await page.$eval('h1', el => el.textContent), /Activity & tasks/)
  await click('Agent team')
  assert.match(await page.$eval('h1', el => el.textContent), /Meet your agents/)
  await click('Settings')
  assert.match(await page.$eval('h1', el => el.textContent), /Workspace settings/)
  const options = await page.$$eval('#interface-language option', list => list.map(el => el.value))
  assert.equal(options.length, 20, 'Expected all 20 locale choices')
  for (const locale of options.filter(code => code !== 'en')) {
    await page.select('#interface-language', locale)
    await page.waitForFunction(code => document.documentElement.lang === code, {}, locale)
    const title = await page.$eval('h1', el => el.textContent)
    assert.notEqual(title, 'Workspace settings', `Settings heading not localized in ${locale}`)
  }
  await page.select('#interface-language', 'pt-BR')
  assert.match(await page.$eval('h1', el => el.textContent), /Configurações do espaço de trabalho/)
  await page.reload({ waitUntil: 'networkidle2' })
  assert.equal(await page.$eval('html', el => el.lang), 'pt-BR', 'Locale should persist across reload')
  assert.match(await page.$eval('h1', el => el.textContent), /Central de controle/)
  assert.doesNotMatch(await page.$eval('.task-tile strong', el => el.textContent), /^Build the dashboard/i, 'Bundled demo prompts should be localized')
  await page.$eval('.intro .primary-btn', el => el.click())
  await page.type('#prompt', 'Mission control')
  await page.$eval('.modal-bottom .primary-btn', el => el.click())
  assert.equal(await page.$eval('.task-tile strong', el => el.textContent), 'Mission control', 'User-entered prompts must not be translated')
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.$eval('.settings-nav', el => el.click())
  assert.match(await page.$eval('h1', el => el.textContent), /Configurações do espaço de trabalho/)
  assert.equal(await page.$eval('#interface-language', el => el.value), 'pt-BR')
  assert.deepEqual(errors, [], 'Browser console errors: ' + errors.join(' | '))
  console.log(JSON.stringify({ ok: true, screenshot, renderState, languagesChecked: options.length, persistedLanguage: 'pt-BR', mobileSettings: true, pagesChecked: ['studio', 'modal', 'tasks', 'team', 'settings'] }, null, 2))
} finally {
  await browser.close()
}
