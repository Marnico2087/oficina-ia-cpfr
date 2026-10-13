const { spawn } = require('node:child_process')
const { randomUUID } = require('node:crypto')
const { realpathSync } = require('node:fs')
const { join } = require('node:path')
const { freePort, waitUntilReady, resolveLaunch } = require('./runtime.cjs')

let running = null
let opening = Promise.resolve()
let stopping = Promise.resolve()
let disposed = false

async function stop() {
  if (!running) return stopping
  const { child, instanceId } = running
  running = null
  if (child.exitCode !== null || child.signalCode !== null) return stopping
  stopping = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (process.platform !== 'win32') {
        try { process.kill(-child.pid, 'SIGKILL') }
        catch (error) { if (error.code === 'ESRCH') resolve(); else reject(error) }
        return
      }
      const killer = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/pid', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
      killer.once('error', reject)
      killer.once('close', code => code === 0 || child.exitCode !== null ? resolve() : reject(new Error('Could not stop the previous office.')))
    }, 3000)
    child.once('close', () => { clearTimeout(timer); resolve() })
    if (child.connected) child.send({ type: 'agent-office:shutdown', instanceId }, () => {})
    else if (process.platform !== 'win32') {
      try { process.kill(-child.pid, 'SIGTERM') }
      catch (error) { clearTimeout(timer); if (error.code === 'ESRCH') resolve(); else reject(error) }
    }
  })
  return stopping
}

function activate(context, vscode = require('vscode')) {
  disposed = false
  const output = vscode.window.createOutputChannel('Agent Office')
  context.subscriptions.push(output)
  const open = async () => {
    if (disposed) return
    if (vscode.workspace.isTrusted === false) {
      vscode.window.showErrorMessage('Trust this workspace before starting Agent Office.')
      return
    }
    const document = vscode.window.activeTextEditor?.document
    let folder = (document && vscode.workspace.getWorkspaceFolder?.(document.uri) || vscode.workspace.workspaceFolders?.[0])?.uri.fsPath
    if (!folder) {
      vscode.window.showErrorMessage('Open a project folder in VS Code before opening Agent Office.')
      return
    }
    try {
      folder = realpathSync(folder)
      if (running?.folder !== folder || running.child.exitCode !== null || running.child.signalCode !== null || running.child.agentOfficeError) {
        await stop()
        const port = await freePort()
        const raw = vscode.workspace.getConfiguration('agentOffice').get('command', 'agent-office')
        const { command, args } = resolveLaunch(raw)
        const instanceId = randomUUID()
        const child = spawn(command, [...args, '--no-open', '--port', String(port), '--workspace', folder], {
          cwd: folder,
          shell: false,
          detached: process.platform !== 'win32',
          env: { ...process.env, AGENT_OFFICE_INSTANCE_ID: instanceId },
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
        })
        child.stdout.on('data', data => output.append(data.toString()))
        child.stderr.on('data', data => output.append(data.toString()))
        child.on('error', error => { child.agentOfficeError = error; output.appendLine(`Start failed: ${error.message}`) })
        running = { folder, port, child, instanceId }
        await waitUntilReady(port, child, 20000, { folder, instanceId })
      }
      if (disposed) { await stop(); return }
      await vscode.commands.executeCommand('simpleBrowser.show', `http://127.0.0.1:${running.port}/`, {
        viewColumn: vscode.ViewColumn.Beside,
      })
    } catch (error) {
      await stop().catch(() => {})
      output.show(true)
      vscode.window.showErrorMessage(`Agent Office: ${error.message}`)
    }
  }
  context.subscriptions.push(vscode.commands.registerCommand('agent-office.open', () => {
    opening = opening.then(open, open)
    return opening
  }))
  context.subscriptions.push({ dispose() { disposed = true; void opening.then(stop).catch(() => {}) } })
}

async function deactivate() { disposed = true; await opening; await stop() }
module.exports = { activate, deactivate }
