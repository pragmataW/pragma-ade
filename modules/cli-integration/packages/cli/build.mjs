// Bundles the `pragma` CLI into dist/pragma.cjs (zod and the bridge client included; runs under Electron-as-Node).
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SELF = fileURLToPath(import.meta.url)
const PKG_DIR = dirname(SELF)
export const DEFAULT_OUTFILE = join(PKG_DIR, 'dist', 'pragma.cjs')
const VERSION = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8')).version

/** Builds the bundle and returns its absolute path (independent of the cwd). */
export async function buildCli(opts = {}) {
  const outfile = opts.outfile ?? DEFAULT_OUTFILE
  await build({
    entryPoints: [join(PKG_DIR, 'src', 'bin.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
    banner: { js: '#!/usr/bin/env node' },
    define: { PRAGMA_CLI_VERSION: JSON.stringify(VERSION) },
    outfile,
    minifyWhitespace: true,
    minifySyntax: true,
    logLevel: 'warning',
  })
  return outfile
}

if (process.argv[1] && resolve(process.argv[1]) === SELF) await buildCli()
