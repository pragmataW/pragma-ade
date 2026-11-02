import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ThemeMode } from '@pragma/sdk'
import { TERMINAL_SETTINGS_DEFAULTS, type TerminalSettings } from '../../src/contract'
import { PtyServiceImpl } from '../../src/main/pty-service'
import { stopHosts, testHost } from './host'

export const SHELL_ENV_MARK = 'from-shell-env'
const dirs: string[] = []

/** A realpath'd temp dir removed by `stopPtyServices()`. */
export function tempDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'pragma-terminal-')))
  dirs.push(dir)
  return dir
}

/** A `PtyServiceImpl` on a real `DaemonHost`; the shell env carries `MARK=from-shell-env`. */
export async function testPtyService(
  opts: {
    settings?: Partial<TerminalSettings>
    resolveCommand?: (cmd: string) => Promise<string | null>
    themeMode?: ThemeMode
    shellEnv?: Record<string, string>
  } = {},
) {
  const { host, log } = await testHost({ restartDelaysMs: [20] })
  await host.start()
  const settings = { ...TERMINAL_SETTINGS_DEFAULTS, shell: '/bin/sh', ...opts.settings }
  const pty = new PtyServiceImpl({
    host,
    shellEnv: async () => ({ PATH: process.env.PATH ?? '', HOME: tmpdir(), MARK: SHELL_ENV_MARK, ...opts.shellEnv }),
    resolveCommand: opts.resolveCommand ?? (async (c) => (c.startsWith('/') && existsSync(c) ? c : null)),
    settings: () => settings,
    themeMode: () => opts.themeMode ?? 'dark',
    platform: process.platform,
    exists: existsSync,
    log,
  })
  return { pty, host, log }
}

export async function stopPtyServices(): Promise<void> {
  await stopHosts()
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
}

/** Collects a pty's output. */
export function output(pty: PtyServiceImpl, ptyId: string) {
  let text = ''
  pty.onData(ptyId, (d) => {
    text += d
  })
  return () => text
}
