const { spawn } = require('node:child_process')
const { freePort, waitUntilReady } = require('./runtime.cjs')

let running = null

function stop() {
  if (!running) return
  const { child } = running
  running = null
  if (child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    // The npm global executable is a .cmd wrapper; terminate its child process too.
    const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    killer.on('error', () => {})
  } else child.kill()
}

function activate(context, vscode = require('vscode')) {
  const output = vscode.window.createOutputChannel('Agent Office')
  context.subscriptions.push(output)
  context.subscriptions.push(vscode.commands.registerCommand('agent-office.open', async () => {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!folder) {
      vscode.window.showErrorMessage('Open a project folder in VS Code before opening Agent Office.')
      return
    }
    try {
      if (running?.folder !== folder || running.child.exitCode !== null) {
        stop()
        const port = await freePort()
        const raw = vscode.workspace.getConfiguration('agentOffice').get('command', 'agent-office')
        const command = process.platform === 'win32' && raw === 'agent-office' ? 'agent-office.cmd' : raw
        const child = spawn(command, ['--no-open', '--port', String(port)], {
          cwd: folder,
          shell: process.platform === 'win32',
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
        child.stdout.on('data', data => output.append(data.toString()))
        child.stderr.on('data', data => output.append(data.toString()))
        child.on('error', error => { child.agentOfficeError = error; output.appendLine(`Start failed: ${error.message}`) })
        running = { folder, port, child }
        await waitUntilReady(port, child)
      }
      await vscode.commands.executeCommand('simpleBrowser.show', `http://127.0.0.1:${running.port}/`, {
        viewColumn: vscode.ViewColumn.Beside,
      })
    } catch (error) {
      stop()
      output.show(true)
      vscode.window.showErrorMessage(`Agent Office: ${error.message}`)
    }
  }))
}

function deactivate() { stop() }
module.exports = { activate, deactivate }
