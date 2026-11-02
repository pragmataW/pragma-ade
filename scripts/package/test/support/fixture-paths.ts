import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { CACHE_ENV } from '../../constants.ts'
import { run } from '../../lib/exec.ts'
import { copyDir } from '../../lib/fsx.ts'
import { writeTree } from './repo.ts'

export const MINI_REPO_FIXTURE = resolve(import.meta.dirname, '../fixtures/mini-repo')
/** Stable across int test files, so probe/audit tests reuse the toolchain proof's dist/ (paths with spaces). */
export const MINI_REPO_DIR = join(tmpdir(), 'pragma mini repo')
export const INT_CACHE_DIR = join(tmpdir(), 'pragma packaging test cache')
export const MINI_DIST = join(MINI_REPO_DIR, 'dist')

/** Build outputs are gitignored (`out/`, `dist/`), so the fixture writes them here. */
const GENERATED: Record<string, string> = {
  'apps/desktop/out/main/index.js': [
    "import Database from 'better-sqlite3'",
    "import { app } from 'electron'",
    "import watcher from '../../../../modules/projects/node_modules/@parcel/watcher/index.js'",
    '',
    'app.whenReady().then(() => {',
    "  new Database(':memory:').close()",
    '  console.log(typeof watcher.subscribe)',
    '  app.quit()',
    '})',
    '',
  ].join('\n'),
  'apps/desktop/out/preload/index.cjs': '',
  'apps/desktop/out/renderer/index.html': '<!doctype html><title>mini</title>\n',
  'modules/terminal/packages/pty-daemon/dist/pty-daemon.cjs': "const pty = require('node-pty')\nmodule.exports = pty\n",
}

/** The int tests' tool cache (natives compiled in Docker are reused between runs; never the user's cache). */
export function useIntCache(): void {
  process.env[CACHE_ENV] = INT_CACHE_DIR
}

const REPO_ROOT = resolve(import.meta.dirname, '../../../..')
/** The real repo's packaging config, icons and legal files travel with the mini repo (`--repo` reads them from the repo root). */
const SHARED_CONFIG = ['electron-builder.yml', 'build', 'LICENSE', 'THIRD_PARTY_NOTICES.md']
const PNPM_INSTALL = [
  'install',
  '--ignore-scripts',
  '--config.strict-dep-builds=false',
  '--config.confirm-modules-purge=false',
]

/** Fresh copy of the mini repo (default `MINI_REPO_DIR`) with its dependencies installed (no install scripts). */
export async function prepareMiniRepo(dir = MINI_REPO_DIR): Promise<string> {
  rmSync(dir, { recursive: true, force: true })
  copyDir(MINI_REPO_FIXTURE, dir)
  writeTree(dir, GENERATED)
  for (const rel of SHARED_CONFIG) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true })
    copyDir(join(REPO_ROOT, rel), join(dir, rel))
  }
  await run('pnpm', PNPM_INSTALL, { cwd: dir, env: { ...process.env, CI: '1' } })
  return dir
}

/** `node scripts/package/cli.ts <args>` with the int test cache; resolves with the exit code and output. */
export function runCli(args: readonly string[]) {
  return run('node', [join(REPO_ROOT, 'scripts/package/cli.ts'), ...args], {
    allowFail: true,
    env: { ...process.env, [CACHE_ENV]: INT_CACHE_DIR },
  })
}
