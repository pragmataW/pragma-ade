import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import {
  BACKOFF_MS,
  CRASH_WINDOW_MS,
  SERVER_EVENT as EV,
  HEALTH_FAILURES,
  HEALTH_INTERVAL_MS,
  HEALTH_TIMEOUT_MS,
  HOST,
  MAX_CRASHES,
  NODE_EVENT,
  PIPED_STDIO,
  READY_POLL_MS,
  READY_TIMEOUT_MS,
  SERVER_LOG_PREFIX,
  SIGNALS,
  STOP_TIMEOUT_MS,
  TASKKILL,
  TOKEN_IN_URL_RE,
  TOKEN_REDACTED,
  VERSION_PATH,
  WIN32,
} from '../../constants'
import { EDITOR_ERROR, editorErrorI18nKey } from '../../contract'

export interface ServerCommand {
  command: string
  argsPrefix: string[]
  shell: boolean
}

export interface ServerProcessOptions extends ServerCommand {
  args: string[]
  env: NodeJS.ProcessEnv
  port: number
  readyTimeoutMs?: number
  healthIntervalMs?: number
  healthFailures?: number
  maxCrashes?: number
  crashWindowMs?: number
  backoffMs?: readonly number[]
  log: (line: string) => void
}

const START_FAILED = editorErrorI18nKey(EDITOR_ERROR.serverStartFailed)
const CRASHED = editorErrorI18nKey(EDITOR_ERROR.serverCrashed)

export type ServerEvent =
  | { type: 'ready'; port: number }
  | { type: 'restarting'; attempt: number }
  | { type: 'failed'; errorKey: typeof START_FAILED | typeof CRASHED; detail: string }
  | { type: 'stopped' }

const IS_WIN = process.platform === WIN32
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
export const redactToken = (line: string): string => line.replace(TOKEN_IN_URL_RE, TOKEN_REDACTED)

/** `/version` answered 200 within `timeoutMs`. */
async function probeVersion(port: number, timeoutMs: number): Promise<boolean> {
  try {
    const res = await fetch(`http://${HOST}:${port}${VERSION_PATH}`, { signal: AbortSignal.timeout(timeoutMs) })
    await res.arrayBuffer()
    return res.ok
  } catch {
    return false
  }
}

/** SIGTERM/SIGKILL to the whole process group (posix) or `taskkill /T /F` (win32). */
function killTree(child: ChildProcess, signal: NodeJS.Signals): void {
  if (child.pid === undefined || child.exitCode !== null) return
  try {
    if (IS_WIN) spawn(TASKKILL.command, [...TASKKILL.args, String(child.pid)], { stdio: PIPED_STDIO[0] })
    else process.kill(-child.pid, signal)
  } catch {
    // already gone
  }
}

/** Own process group on posix (so stop can kill the tree), piped output, no console window on win32. */
const spawnServer = (cmd: ServerCommand, args: string[], env: NodeJS.ProcessEnv): ChildProcess =>
  spawn(cmd.command, [...cmd.argsPrefix, ...args], {
    env,
    shell: cmd.shell,
    detached: !IS_WIN,
    stdio: PIPED_STDIO,
    windowsHide: true,
  })

const exited = (child: ChildProcess): Promise<void> =>
  child.exitCode !== null || child.signalCode !== null
    ? Promise.resolve()
    : new Promise((r) => child.once(NODE_EVENT.exit, () => r()))

class StartError extends Error {}

/** One supervised `codium-server`: readiness, health probes, crash restarts with backoff, tree kill on stop. */
export class ServerProcess {
  readonly #o: ServerProcessOptions
  readonly #listeners = new Set<(e: ServerEvent) => void>()
  #child: ChildProcess | undefined
  #stopping = false
  #crashes: number[] = []
  #health: ReturnType<typeof setInterval> | undefined
  #healthMisses = 0

  constructor(o: ServerProcessOptions) {
    this.#o = o
  }

  get pid(): number | undefined {
    return this.#child?.pid
  }

  on(cb: (e: ServerEvent) => void): () => void {
    this.#listeners.add(cb)
    return () => void this.#listeners.delete(cb)
  }

  async start(): Promise<void> {
    this.#stopping = false
    try {
      await this.#spawnAndWait()
    } catch (error) {
      this.#emit({ type: EV.failed, errorKey: START_FAILED, detail: String(error) })
      throw error
    }
  }

  async stop(timeoutMs = STOP_TIMEOUT_MS): Promise<void> {
    this.#stopping = true
    this.#stopHealth()
    const child = this.#child
    if (child) {
      killTree(child, SIGNALS.term)
      const done = await Promise.race([exited(child).then(() => true), sleep(timeoutMs).then(() => false)])
      if (!done) {
        killTree(child, SIGNALS.kill)
        await exited(child)
      }
    }
    this.#child = undefined
    this.#emit({ type: EV.stopped })
  }

  async restart(): Promise<void> {
    await this.stop()
    this.#crashes = []
    await this.start()
  }

  #emit(e: ServerEvent): void {
    for (const cb of [...this.#listeners]) cb(e)
  }

  #pipe(stream: NodeJS.ReadableStream | null): void {
    if (!stream) return
    createInterface({ input: stream }).on('line', (l) => this.#o.log(`${SERVER_LOG_PREFIX} ${redactToken(l)}`))
  }

  #spawn(): ChildProcess {
    const o = this.#o
    const child = spawnServer(o, o.args, o.env)
    this.#pipe(child.stdout)
    this.#pipe(child.stderr)
    child.on(NODE_EVENT.error, (e) => o.log(`${SERVER_LOG_PREFIX} spawn error: ${e.message}`))
    return child
  }

  async #spawnAndWait(): Promise<void> {
    const child = this.#spawn()
    this.#child = child
    let gone = false
    void exited(child).then(() => {
      gone = true
    })
    const deadline = Date.now() + (this.#o.readyTimeoutMs ?? READY_TIMEOUT_MS)
    while (!(await probeVersion(this.#o.port, HEALTH_TIMEOUT_MS))) {
      if (gone) throw new StartError(`exited with code ${child.exitCode ?? child.signalCode}`)
      if (Date.now() > deadline || this.#stopping) {
        killTree(child, SIGNALS.kill)
        throw new StartError('timed out waiting for /version')
      }
      await sleep(READY_POLL_MS)
    }
    child.once(NODE_EVENT.exit, (code, signal) => void this.#onExit(child, `${code ?? signal}`))
    this.#startHealth(child)
    this.#emit({ type: EV.ready, port: this.#o.port })
  }

  #startHealth(child: ChildProcess): void {
    this.#stopHealth()
    this.#healthMisses = 0
    this.#health = setInterval(() => {
      void probeVersion(this.#o.port, HEALTH_TIMEOUT_MS).then((ok) => {
        this.#healthMisses = ok ? 0 : this.#healthMisses + 1
        if (this.#healthMisses >= (this.#o.healthFailures ?? HEALTH_FAILURES)) {
          this.#o.log(`${SERVER_LOG_PREFIX} health check failed, restarting`)
          this.#stopHealth()
          killTree(child, SIGNALS.kill)
        }
      })
    }, this.#o.healthIntervalMs ?? HEALTH_INTERVAL_MS)
  }

  #stopHealth(): void {
    if (this.#health) clearInterval(this.#health)
    this.#health = undefined
  }

  /** Records a crash; true (and `failed` emitted) when the window's crash budget is spent. */
  #budgetSpent(how: string): boolean {
    const now = Date.now()
    const windowMs = this.#o.crashWindowMs ?? CRASH_WINDOW_MS
    this.#crashes = [...this.#crashes.filter((t) => now - t < windowMs), now]
    if (this.#crashes.length <= (this.#o.maxCrashes ?? MAX_CRASHES)) return false
    this.#child = undefined
    this.#emit({ type: EV.failed, errorKey: CRASHED, detail: `exited ${this.#crashes.length} times (${how})` })
    return true
  }

  /** Unexpected exit: restart with backoff unless the crash budget of the window is spent. */
  async #onExit(child: ChildProcess, how: string): Promise<void> {
    if (this.#stopping || this.#child !== child) return
    this.#stopHealth()
    this.#o.log(`${SERVER_LOG_PREFIX} exited unexpectedly (${how})`)
    while (!this.#budgetSpent(how)) {
      const attempt = this.#crashes.length
      this.#emit({ type: EV.restarting, attempt })
      const backoff = this.#o.backoffMs ?? BACKOFF_MS
      await sleep(backoff[Math.min(attempt - 1, backoff.length - 1)] ?? 0)
      if (this.#stopping) return
      try {
        await this.#spawnAndWait()
        return
      } catch (error) {
        this.#o.log(`${SERVER_LOG_PREFIX} restart failed: ${String(error)}`)
      }
    }
  }
}

/** Runs the server binary once (e.g. `--install-extension`), killing it after `timeoutMs`. */
export function runOnce(
  cmd: ServerCommand,
  args: string[],
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawnServer(cmd, args, env)
    let stdout = ''
    let stderr = ''
    child.stdout?.on(NODE_EVENT.data, (d) => {
      stdout += String(d)
    })
    child.stderr?.on(NODE_EVENT.data, (d) => {
      stderr += String(d)
    })
    const timer = setTimeout(() => killTree(child, SIGNALS.kill), timeoutMs)
    child.on(NODE_EVENT.error, (e) => {
      stderr += e.message
    })
    child.on(NODE_EVENT.close, (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? -1, stdout, stderr })
    })
  })
}
