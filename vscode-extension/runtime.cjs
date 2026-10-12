const net = require('node:net')
const http = require('node:http')

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

async function waitUntilReady(port, child, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.agentOfficeError) throw child.agentOfficeError
    if (child.exitCode != null || child.signalCode != null || child.killed) throw new Error('Agent Office process stopped during startup.')
    const ok = await new Promise(resolve => {
      const req = http.get(`http://127.0.0.1:${port}/api/state`, res => {
        res.resume()
        resolve(res.statusCode === 200)
      })
      req.setTimeout(350, () => req.destroy())
      req.on('error', () => resolve(false))
    })
    if (ok) return
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  throw new Error('Agent Office did not start within 20 seconds. Check the Output panel for details.')
}

module.exports = { freePort, waitUntilReady }
