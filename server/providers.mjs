import { existsSync } from 'node:fs'
import { delimiter, dirname, isAbsolute, join, sep } from 'node:path'

export const PROVIDERS = [
  { id: 'codex', name: 'Codex CLI', env: 'CODEX_BIN' },
  { id: 'claude', name: 'Claude Code', env: 'CLAUDE_BIN' },
  { id: 'gemini', name: 'Gemini CLI', env: 'GEMINI_BIN' },
]

export function discoverProviders(env = process.env, platform = process.platform) {
  const folders = (env.PATH || env.Path || '').split(delimiter).filter(Boolean)
  return PROVIDERS.map(provider => {
    const configured = env[provider.env]
    let bin = configured && isAbsolute(configured) && existsSync(configured) ? configured : null
    if (!configured) {
      const names = platform === 'win32'
        ? [`${provider.id}.exe`, `${provider.id}.cmd`]
        : [provider.id]
      for (const folder of folders) {
        for (const name of names) {
          const candidate = join(folder, name)
          if (existsSync(candidate)) { bin = candidate; break }
        }
        if (bin) break
      }
    }
    // Recent Claude Code npm shims delegate to a native executable.
    // Prefer it on Windows so Node can spawn without a shell.
    if (bin?.toLowerCase().endsWith('.cmd')) {
      const relative = provider.id === 'claude'
        ? join('@anthropic-ai', 'claude-code', 'bin', 'claude.exe')
        : provider.id === 'gemini'
          ? join('@google', 'gemini-cli', 'dist', 'index.js')
          : join('@openai', 'codex', 'bin', 'codex.js')
      const direct = join(dirname(bin), 'node_modules', relative)
      if (existsSync(direct)) bin = direct
      else bin = null // Avoid a cmd.exe shell for paths supplied by task requests.
    }
    return { id: provider.id, name: provider.name, available: Boolean(bin), bin }
  })
}

export function launchArgs(id, workspace) {
  if (id === 'codex') return ['exec', '--json', '--skip-git-repo-check', '-s', 'workspace-write', '-C', workspace, '-']
  if (id === 'claude') return ['--print', '--verbose', '--output-format', 'stream-json', '--permission-mode', 'acceptEdits', '--permission-prompts', 'none']
  if (id === 'gemini') return ['-p', '--output-format', 'stream-json', '--approval-mode', 'auto_edit']
  throw new Error('Motor de IA desconhecido.')
}

export function foldersOverlap(left, right, platform = process.platform) {
  const normalize = path => platform === 'win32' ? path.toLowerCase() : path
  const a = normalize(left)
  const b = normalize(right)
  return a === b || a.startsWith(b + sep) || b.startsWith(a + sep)
}
