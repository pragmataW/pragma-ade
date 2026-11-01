import { execFile } from 'node:child_process'
import { PLATFORM, SHELL_ENV_TIMEOUT_MS } from '../../constants'

export type Runner = (cmd: string, args: string[], opts: { timeoutMs: number }) => Promise<string>

const DEFAULT_SHELL = '/bin/sh'
const ENV_ARGS = ['-ilc', 'env -0']
const NUL = '\0'
const MAX_BUFFER_BYTES = 16_777_216

const defaultRunner: Runner = (cmd, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES, encoding: 'utf8' }, (error, stdout) =>
      error ? reject(error) : resolve(stdout),
    )
  })

const cache = new WeakMap<Runner, Map<string, Promise<Record<string, string>>>>()

const processEnv = (): Record<string, string> =>
  Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => e[1] !== undefined))

export function parseEnvZero(output: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const entry of output.split(NUL)) {
    const eq = entry.indexOf('=')
    if (eq > 0) env[entry.slice(0, eq)] = entry.slice(eq + 1)
  }
  return env
}

async function load(shell: string, timeoutMs: number, run: Runner): Promise<Record<string, string>> {
  try {
    const env = parseEnvZero(await run(shell, ENV_ARGS, { timeoutMs }))
    return Object.keys(env).length > 0 ? env : processEnv()
  } catch {
    return processEnv()
  }
}

/** Login-shell environment (`$SHELL -ilc 'env -0'`), cached; falls back to `process.env`. */
export function resolveShellEnv(opts: {
  shell?: string
  platform: string
  timeoutMs?: number
  run?: Runner
}): Promise<Record<string, string>> {
  if (opts.platform === PLATFORM.win32) return Promise.resolve(processEnv())
  const run = opts.run ?? defaultRunner
  const shell = opts.shell ?? process.env.SHELL ?? DEFAULT_SHELL
  const perRunner = cache.get(run) ?? new Map()
  cache.set(run, perRunner)
  const existing = perRunner.get(shell)
  if (existing) return existing
  const pending = load(shell, opts.timeoutMs ?? SHELL_ENV_TIMEOUT_MS, run)
  perRunner.set(shell, pending)
  return pending
}
