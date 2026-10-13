import { spawn } from 'node:child_process'
import { join } from 'node:path'

// POSIX children must be started with detached:true to own their process group.
// Windows has no equivalent group signal; taskkill handles the descendant tree.
export async function terminateProcess(child) {
  if (!child?.pid) return
  if (process.platform === 'win32') {
    await new Promise((resolve, reject) => {
      const killer = spawn(join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
        ['/pid', String(child.pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' })
      killer.once('error', reject)
      killer.once('close', code => code === 0 || child.exitCode !== null || child.signalCode !== null
        ? resolve() : reject(new Error('Could not terminate the provider process tree.')))
    })
    return
  }
  const signal = value => {
    try { process.kill(-child.pid, value); return true }
    catch (error) { if (error.code === 'ESRCH') return false; throw error }
  }
  if (!signal('SIGTERM')) return
  await new Promise(resolve => setTimeout(resolve, 500))
  signal('SIGKILL')
}
