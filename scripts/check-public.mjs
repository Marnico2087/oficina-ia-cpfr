import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const forbidden = /(^|\/)(?:\.local|node_modules|dist|coverage|screenshots|work|\.git|\.env(?:\..+)?|id_rsa[^/]*|id_ed25519[^/]*|credentials\.json|secrets\.json|[^/]+\.(?:pem|p12|pfx|key|crt|cer|secret))(\/|$)/i
const privateData = [
  { label: 'private key header', pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/i },
  { label: 'known token prefix', pattern: /\b(?:ghp_|gho_|ghu_|ghs_|github_pat_|sk-proj-|sk_live_|rk_live_|xox[baprs]-|AKIA[0-9A-Z]{16})[A-Za-z0-9_-]{8,}/ },
  { label: 'local Windows user directory', pattern: /[A-Z]:\\Users\\[^\\\r\n]+\\/i },
  { label: 'sensitive assignment', pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?token|password|passwd)\s*[:=]\s*["']?[A-Za-z0-9_/+=-]{24,}["']?/i },
  { label: 'email address in public source', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
]
const textTypes = new Set(['.ts','.tsx','.js','.mjs','.cjs','.json','.md','.html','.css','.svg','.txt','.yml','.yaml','.sh','.ps1','.cmd','.bat','.xml','.toml'])

export function auditPublic(directory = process.cwd(), requireClean = false) {
  const git = args => execFileSync('git', args, { cwd: directory, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  const tracked = git(['ls-files', '--cached', '-z']).split('\0').filter(Boolean)
  const untracked = git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0').filter(Boolean)
  const paths = [...new Set([...tracked, ...untracked])]
  const errors = []
  for (const path of paths) {
    const normalized = path.replaceAll('\\', '/')
    if (forbidden.test(normalized) && normalized !== '.env.example') errors.push(path + ': forbidden private path')
    const check = (contents, location) => {
      if (contents.length > 5 * 1024 * 1024) { errors.push(path + ': unexpected file over 5 MiB (' + location + ')'); return }
      if (!textTypes.has(extname(path).toLowerCase()) && !['.gitignore','.gitattributes','.env.example','LICENSE'].includes(normalized)) return
      const value = contents.toString('utf8')
      for (const { label, pattern } of privateData) if (pattern.test(value)) errors.push(path + ': possible ' + label + ' (' + location + ')')
    }
    if (tracked.includes(path)) {
      // Audit the index as well: a clean working copy cannot hide staged secrets.
      check(Buffer.from(git(['show', ':' + path])), 'index')
    }
    try { check(readFileSync(resolve(directory, path)), 'working tree') }
    catch (error) { if (error.code !== 'ENOENT') errors.push(path + ': could not read working file') }
  }
  if (requireClean && git(['status', '--porcelain', '--untracked-files=normal']).trim()) {
    errors.push('Working tree is not clean. Commit or remove pending changes before pushing.')
  }
  return { paths, errors: [...new Set(errors)] }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { paths, errors } = auditPublic(process.cwd(), process.argv.includes('--require-clean'))
  if (errors.length) {
    console.error('Public release audit FAILED:\n' + errors.map(x => ' - ' + x).join('\n'))
    process.exitCode = 1
  } else console.log('Public release audit OK: ' + paths.length + ' paths checked in the index and working tree.')
}
