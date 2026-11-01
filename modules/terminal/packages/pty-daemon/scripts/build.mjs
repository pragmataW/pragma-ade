// Bundles the pty-daemon into dist/pty-daemon.cjs (node-pty stays external: it is a native module).
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SELF = fileURLToPath(import.meta.url)
const PKG_DIR = join(dirname(SELF), '..')
export const DEFAULT_OUTFILE = join(PKG_DIR, 'dist', 'pty-daemon.cjs')

/** Builds the bundle and returns its absolute path (independent of the cwd). */
export async function buildDaemon(opts = {}) {
  const outfile = opts.outfile ?? DEFAULT_OUTFILE
  await build({
    entryPoints: [join(PKG_DIR, 'src', 'entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node22',
    external: ['node-pty'],
    outfile,
    // whitespace/syntax only: keeps names readable in stack traces and the bundle under Biome's 1 MiB limit
    minifyWhitespace: true,
    minifySyntax: true,
    logLevel: 'warning',
  })
  return outfile
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) await buildDaemon()
