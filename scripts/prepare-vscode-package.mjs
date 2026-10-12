import { mkdir } from 'node:fs/promises'

// GitHub Actions checks out the repository without ignored work/ directories.
await mkdir(new URL('../work/', import.meta.url), { recursive: true })
