import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildDaemon, DEFAULT_OUTFILE } from '../../packages/pty-daemon/scripts/build.mjs'

const DAEMON_NODE_MODULES = join(DEFAULT_OUTFILE, '..', '..', 'node_modules')
let built: Promise<string> | undefined

/** Builds the daemon bundle once per test worker into a temp dir (parallel workers never share the file). */
export function builtDaemon(): Promise<string> {
  built ??= (async () => {
    const dir = mkdtempSync(join(tmpdir(), 'pragma-pty-daemon-'))
    process.once('exit', () => rmSync(dir, { recursive: true, force: true }))
    return buildDaemon({ outfile: join(dir, 'pty-daemon.cjs') })
  })()
  return built
}

/** Env for a forked test bundle: `node-pty` (external) resolves from the daemon package's node_modules. */
export const daemonEnv = (): NodeJS.ProcessEnv => ({ ...process.env, NODE_PATH: DAEMON_NODE_MODULES })
