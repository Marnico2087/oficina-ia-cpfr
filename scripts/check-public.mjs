import { execFileSync } from 'node:child_process'
import { extname } from 'node:path'

const paths = execFileSync('git', ['ls-files', '--cached', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
const errors = []
const forbidden = /(^|\/)(?:\.local|node_modules|dist|coverage|screenshots|work|\.git|\.env(?:\..+)?|id_rsa[^/]*|id_ed25519[^/]*|credentials\.json|secrets\.json|[^/]+\.(?:pem|p12|pfx|key|crt|cer|secret))(\/|$)/i
const privateData = [
  { label: 'private key header', pattern: /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/i },
  { label: 'known token prefix', pattern: /\b(?:ghp_|gho_|ghu_|ghs_|github_pat_|sk-proj-|sk_live_|rk_live_|xox[baprs]-|AKIA[0-9A-Z]{16})[A-Za-z0-9_-]{8,}/ },
  { label: 'local Windows user directory', pattern: /[A-Z]:\\Users\\[^\\\r\n]+\\/i },
  { label: 'sensitive assignment', pattern: /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|private[_-]?token|password|passwd)\s*[:=]\s*["']?[A-Za-z0-9_/+=-]{24,}["']?/i },
  { label: 'email address in public source', pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
]
const textTypes = new Set(['.ts','.tsx','.js','.mjs','.cjs','.json','.md','.html','.css','.svg','.txt','.yml','.yaml','.sh','.ps1','.xml','.toml'])
for (const path of paths) {
  const normalized = path.replaceAll('\\', '/')
  if (forbidden.test(normalized) && normalized !== '.env.example') errors.push(path + ': forbidden private path')
  const size = Number(execFileSync('git', ['cat-file', '-s', ':' + path], { encoding: 'utf8' }).trim())
  if (size > 5 * 1024 * 1024) errors.push(path + ': unexpected file over 5 MiB')
  if (!textTypes.has(extname(path).toLowerCase()) && !['.gitignore','.gitattributes','LICENSE'].includes(path)) continue
  const contents = execFileSync('git', ['show', ':' + path], { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
  for (const {label, pattern} of privateData) {
    if (pattern.test(contents)) errors.push(path + ': possible ' + label)
  }
}
if (process.argv.includes('--require-clean')) {
  const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { encoding: 'utf8' }).trim()
  if (status) errors.push('Working tree is not clean. Commit or remove pending changes before pushing.')
}
if (errors.length) {
  console.error('Public release audit FAILED:\n' + errors.map(x => ' - ' + x).join('\n'))
  process.exit(1)
}
console.log('Public release audit OK: ' + paths.length + ' tracked paths checked.')
