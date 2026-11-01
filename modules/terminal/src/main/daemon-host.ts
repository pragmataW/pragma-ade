import { type ChildProcess, fork } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { Logger } from '@pragma/sdk'
import {
  DAEMON_ERROR,
  type DaemonErrorCode,
  type DaemonEvent,
  type DaemonMessage,
  type DaemonRequestInput,
  MSG,
  PROTOCOL_VERSION,
  REQ,
} from '@pragma/terminal-pty-daemon/protocol'
import {
  DAEMON_STDIO,
  DAEMON_UNAVAILABLE,
  EXIT_EVENT,
  HOST_SHUTDOWN_TIMEOUT_MS,
  KILL_NOW_SIGNAL,
  MAX_RESTARTS_PER_MINUTE,
  RESTART_DELAYS_MS,
  RESTART_WINDOW_MS,
  RUN_AS_NODE_ENV,
  RUN_AS_NODE_ON,
} from '../constants'

/** A daemon error response (or `INTERNAL` when the daemon died or is unavailable). */
export class DaemonRequestError extends Error {
  readonly code: DaemonErrorCode
  constructor(code: DaemonErrorCode, message: string) {
    super(message)
    this.name = 'DaemonRequestError'
    this.code = code
  }
}

export class DaemonProtocolError extends Error {}

export interface CrashInfo {
  code: number | null
  signal: string | null
}

export interface DaemonHostOptions {
  entryPath: string
  execPath?: string
  env?: NodeJS.ProcessEnv
  log: Logger
  restartDelaysMs?: readonly number[]
  maxRestartsPerMinute?: number
  shutdownTimeoutMs?: number
}

interface Pending {
  resolve(value: unknown): void
  reject(error: Error): void
}

type Listener<T> = (value: T) => void

function listeners<T>() {
  const set = new Set<Listener<T>>()
  return {
    add(cb: Listener<T>): () => void {
      set.add(cb)
      return () => set.delete(cb)
    },
    emit(value: T): void {
      for (const cb of [...set]) cb(value)
    },
  }
}

/** Daemon stdout/stderr, line by line, into the module log. */
function pipeLines(stream: NodeJS.ReadableStream | null, log: (line: string) => void): void {
  if (stream) createInterface({ input: stream }).on('line', (line) => log(line))
}

const internal = (message: string): DaemonRequestError => new DaemonRequestError(DAEMON_ERROR.internal, message)

/** Forks the pty-daemon, correlates requests with responses, and restarts it after a crash. */
export class DaemonHost {
  readonly #opts: Required<Omit<DaemonHostOptions, 'env'>> & { env: NodeJS.ProcessEnv }
  readonly #events = listeners<DaemonEvent>()
  readonly #crashes = listeners<CrashInfo>()
  readonly #restarts = listeners<void>()
  readonly #pending = new Map<number, Pending>()
  #queue: { msg: { id: number } & DaemonRequestInput; pending: Pending }[] = []
  #child: ChildProcess | undefined
  #ready = false
  #nextId = 1
  #restartTimes: number[] = []
  #restartTimer: ReturnType<typeof setTimeout> | undefined
  #stopping: Promise<void> | undefined
  #failed = false
  #started: { resolve(): void; reject(e: Error): void } | undefined

  constructor(opts: DaemonHostOptions) {
    this.#opts = {
      execPath: process.execPath,
      env: process.env,
      restartDelaysMs: RESTART_DELAYS_MS,
      maxRestartsPerMinute: MAX_RESTARTS_PER_MINUTE,
      shutdownTimeoutMs: HOST_SHUTDOWN_TIMEOUT_MS,
      ...opts,
    }
  }

  get pid(): number | undefined {
    return this.#ready ? this.#child?.pid : undefined
  }

  /** Forks the daemon; resolves on its `ready` message. */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.#started = { resolve, reject }
      this.#fork()
    })
  }

  request<T>(req: DaemonRequestInput): Promise<T> {
    if (this.#failed || this.#stopping) return Promise.reject(internal(DAEMON_UNAVAILABLE))
    return new Promise<T>((resolve, reject) => {
      const msg = { ...req, id: this.#nextId++ }
      const pending: Pending = { resolve: (v) => resolve(v as T), reject }
      if (this.#ready && this.#child) this.#send(msg, pending)
      else this.#queue.push({ msg, pending })
    })
  }

  onEvent(cb: Listener<DaemonEvent>): () => void {
    return this.#events.add(cb)
  }

  onCrash(cb: Listener<CrashInfo>): () => void {
    return this.#crashes.add(cb)
  }

  onRestart(cb: () => void): () => void {
    return this.#restarts.add(cb)
  }

  /** Asks the daemon to stop its ptys and exit; SIGKILLs it after the timeout. Exits here are not crashes. */
  shutdown(): Promise<void> {
    this.#stopping ??= this.#stop()
    return this.#stopping
  }

  async #stop(): Promise<void> {
    clearTimeout(this.#restartTimer)
    this.#rejectAll('pty-daemon is shutting down')
    const child = this.#child
    if (!child || child.exitCode !== null || child.signalCode !== null) return
    const exited = new Promise<void>((resolve) => child.once(EXIT_EVENT, () => resolve()))
    if (child.connected) child.send({ id: this.#nextId++, type: REQ.shutdown })
    const timer = setTimeout(() => child.kill(KILL_NOW_SIGNAL), this.#opts.shutdownTimeoutMs)
    await exited
    clearTimeout(timer)
  }

  #fork(): void {
    const child = fork(this.#opts.entryPath, [], {
      execPath: this.#opts.execPath,
      env: { ...this.#opts.env, [RUN_AS_NODE_ENV]: RUN_AS_NODE_ON },
      stdio: DAEMON_STDIO,
    })
    this.#child = child
    this.#ready = false
    pipeLines(child.stdout, this.#opts.log.info)
    pipeLines(child.stderr, this.#opts.log.warn)
    child.on('message', (m) => this.#onMessage(child, m as DaemonMessage))
    child.once(EXIT_EVENT, (code, signal) => this.#onExit(child, { code, signal }))
    child.on('error', (error) => this.#opts.log.error('pty-daemon process error', error))
  }

  #send(msg: { id: number } & DaemonRequestInput, pending: Pending): void {
    this.#pending.set(msg.id, pending)
    this.#child?.send(msg)
  }

  #onMessage(child: ChildProcess, msg: DaemonMessage): void {
    if (child !== this.#child) return
    if (msg.kind === MSG.ready) {
      this.#onReady(child, msg.protocolVersion)
      return
    }
    if (msg.kind !== MSG.response) {
      this.#events.emit(msg)
      return
    }
    const pending = this.#pending.get(msg.id)
    if (!pending) return
    this.#pending.delete(msg.id)
    if (msg.ok) pending.resolve(msg.result)
    else pending.reject(new DaemonRequestError(msg.error.code, msg.error.message))
  }

  #onReady(child: ChildProcess, version: number): void {
    if (version !== PROTOCOL_VERSION) {
      const error = new DaemonProtocolError(`pty-daemon protocol ${version}, expected ${PROTOCOL_VERSION}`)
      this.#failed = true
      this.#opts.log.error(error.message)
      this.#rejectAll(error.message)
      this.#started?.reject(error)
      child.kill(KILL_NOW_SIGNAL)
      return
    }
    const restarted = this.#started === undefined
    this.#ready = true
    this.#opts.log.info(`pty-daemon ready (pid ${child.pid})`)
    for (const { msg, pending } of this.#queue.splice(0)) this.#send(msg, pending)
    this.#started?.resolve()
    this.#started = undefined
    if (restarted) this.#restarts.emit()
  }

  #onExit(child: ChildProcess, info: CrashInfo): void {
    if (child !== this.#child) return
    this.#ready = false
    if (this.#stopping || this.#failed) return
    this.#opts.log.warn(`pty-daemon exited unexpectedly (code ${info.code}, signal ${info.signal})`)
    this.#rejectPending('pty-daemon crashed')
    this.#crashes.emit(info)
    this.#scheduleRestart()
  }

  #scheduleRestart(): void {
    const now = Date.now()
    this.#restartTimes = this.#restartTimes.filter((t) => now - t < RESTART_WINDOW_MS)
    if (this.#restartTimes.length >= this.#opts.maxRestartsPerMinute) {
      this.#failed = true
      this.#opts.log.error(`pty-daemon crashed ${this.#restartTimes.length + 1} times within a minute; giving up`)
      this.#rejectAll(DAEMON_UNAVAILABLE)
      this.#started?.reject(internal(DAEMON_UNAVAILABLE))
      return
    }
    const delays = this.#opts.restartDelaysMs
    const delay = delays[Math.min(this.#restartTimes.length, delays.length - 1)] ?? 0
    this.#restartTimes.push(now)
    this.#restartTimer = setTimeout(() => this.#fork(), delay)
  }

  #rejectPending(message: string): void {
    for (const p of this.#pending.values()) p.reject(internal(message))
    this.#pending.clear()
  }

  #rejectAll(message: string): void {
    this.#rejectPending(message)
    for (const { pending } of this.#queue.splice(0)) pending.reject(internal(message))
  }
}
