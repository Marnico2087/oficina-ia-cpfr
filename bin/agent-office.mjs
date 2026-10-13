#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = (await import('../package.json', { with: { type: 'json' } })).default

export function parseArgs(args) {
  const options = { port: Number(process.env.PORT || 4300), open: true, workspace: process.cwd() }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === '-h' || arg === '--help') return { help: true }
    if (arg === '-v' || arg === '--version') return { version: true }
    if (arg === '--no-open') { options.open = false; continue }
    if (arg === '--port') { options.port = Number(args[++i]); continue }
    if (arg === '--workspace') {
      const value = args[++i]
      if (!value) throw new Error('--workspace requires a directory.')
      options.workspace = resolve(value)
      continue
    }
    throw new Error(`Unknown argument: ${arg}. See agent-office --help.`)
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65535) throw new Error('Port must be between 1 and 65535.')
  try {
    if (!statSync(options.workspace).isDirectory()) throw new Error('not a directory')
    options.workspace = realpathSync(options.workspace)
  } catch { throw new Error(`Workspace does not exist or is not a directory: ${options.workspace}`) }
  return options
}

export function browserCommand(url, platform = process.platform) {
  if (platform === 'win32') return { command: 'cmd.exe', args: ['/d', '/s', '/c', 'start', '""', url] }
  if (platform === 'darwin') return { command: 'open', args: [url] }
  return { command: 'xdg-open', args: [url] }
}

export async function main(args = process.argv.slice(2)) {
  let options
  try { options = parseArgs(args) }
  catch (error) { console.error(`Agent Office: ${error.message}`); process.exitCode = 1; return }
  if (options.help) {
    console.log('Agent Office — local 3D office for coding agents\n\nUsage: agent-office [--port 4300] [--no-open] [--workspace DIRECTORY]\n\nRun from any project folder to use that folder as the default workspace.\nOptions: --help, --version')
    return
  }
  if (options.version) { console.log(version); return }
  if (!existsSync(join(root, 'dist', 'index.html'))) {
    console.error('Agent Office: UI build is missing. Reinstall the latest prebuilt package from GitHub Releases.')
    process.exitCode = 1
    return
  }
  process.env.PORT = String(options.port)
  process.env.AGENT_OFFICE_WORKSPACE = options.workspace
  const workspaceKey = createHash('sha256').update(process.platform === 'win32' ? options.workspace.toLowerCase() : options.workspace).digest('hex').slice(0, 16)
  process.env.AGENT_OFFICE_DATA_DIR ||= process.platform === 'win32'
    ? join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), 'AgentOffice', workspaceKey)
    : join(process.env.XDG_STATE_HOME || join(homedir(), '.local', 'state'), 'agent-office', workspaceKey)
  const url = `http://127.0.0.1:${options.port}/`
  console.log(`Workspace: ${options.workspace}\nOpen: ${url}\nPress Ctrl+C to stop.`)
  const server = await import('../server/index.mjs')
  if (!await server.ready) return server
  if (options.open && !process.exitCode) {
    // Opening is best effort; the terminal URL remains available if no browser is configured.
    const { command, args: openArgs } = browserCommand(url)
    const child = spawn(command, openArgs, { detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', () => {})
    child.unref()
  }
  return server
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main()
