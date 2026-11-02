import { spawn } from 'node:child_process'
import { PLATFORM, SHELL_ENV_TIMEOUT_MS } from '../../constants'

export type Runner = (cmd: string, args: string[], opts: { timeoutMs: number }) => Promise<string>

const DEFAULT_SHELL = '/bin/sh'
const ENV_ARGS = ['-ilc', 'env -0']
const NUL = '\0'
const IGNORE = 'ignore'
const ERROR_EVENT = 'error'

/**
 * stdin is /dev/null so an rc file that starts another interactive shell (`.bashrc` → `zsh`) reads EOF and exits.
 * Timeout SIGKILLs the whole process group: interactive bash ignores SIGTERM and its children keep stdout open.
 */
const defaultRunner: Runner = (cmd, args, { timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: [IGNORE, 'pipe', IGNORE], detached: true })
    let stdout = ''
    child.stdout.setEncoding('utf8').on('data', (d: string) => {
      stdout += d
    })
    const timer = setTimeout(() => {
      try {
        if (child.pid !== undefined) process.kill(-child.pid, 'SIGKILL')
      } catch {
        // already gone
      }
      reject(new Error(`${cmd} timed out`))
    }, timeoutMs)
    child.on(ERROR_EVENT, (e) => {
      clearTimeout(timer)
      reject(e)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout)
      else reject(new Error(`${cmd} exited with ${code}`))
    })
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
