import { access, mkdir, readFile } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function validateVscodePackage(root = fileURLToPath(new URL('../', import.meta.url))) {
  const manifest = JSON.parse(await readFile(resolve(root, 'vscode-extension/package.json'), 'utf8'))
  const application = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
  if (manifest.version !== application.version) throw new Error('VS Code and CLI package versions must match.')
  const base = resolve(root, 'vscode-extension')
  const files = [...new Set([manifest.main, 'package.json', ...(manifest.files || [])])]
  for (const file of files) {
    if (typeof file !== 'string') throw new Error('Invalid VS Code package file.')
    const target = resolve(base, file), remainder = relative(base, target)
    if (!remainder || isAbsolute(remainder) || remainder === '..' || remainder.startsWith('..')) throw new Error('VS Code package file escapes the extension directory.')
    await access(target)
    if (/\.cjs$/.test(file)) {
      const code = await readFile(target, 'utf8')
      for (const match of code.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
        const dependency = match[1]
        if (dependency.startsWith('node:') || dependency === 'vscode') continue
        if (dependency.startsWith('./') && files.some(candidate => resolve(base, candidate) === resolve(base, dependency))) continue
        throw new Error(`VS Code runtime dependency is not packaged: ${dependency}`)
      }
    }
  }
  return files
}

// GitHub Actions checks out the repository without ignored work/ directories.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await validateVscodePackage()
  await mkdir(new URL('../work/', import.meta.url), { recursive: true })
}
