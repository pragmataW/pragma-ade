// Placeholder bundle writer (replaced by the esbuild bundle in Task 4).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(pkgDir, 'dist'), { recursive: true })
writeFileSync(join(pkgDir, 'dist', 'pty-daemon.cjs'), '')
