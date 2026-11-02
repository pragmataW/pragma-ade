import type { Logger } from '@pragma/sdk'
import {
  DAEMON_ERROR,
  type DaemonEvent,
  type KillSignal,
  MSG,
  PTY_STATUS,
  type PtyInfo,
  type PtySnapshot,
  REQ,
  type SpawnSpec,
  TERM_NAME,
} from '@pragma/terminal-pty-daemon/protocol'
import { COLORTERM_VALUE, PATH_SEPARATOR_RE, RUN_AS_NODE_ENV, TERM_PROGRAM_NAME } from '../constants'
import {
  PTY_EXIT_REASON,
  PTY_SPAWN_ERROR,
  type PtyAttachResult,
  type PtyDataPayload,
  type PtyExit,
  type PtyService,
  PtySpawnError,
  type PtySpawnOptions,
  PtySpawnOptionsSchema,
  type TerminalSettings,
} from '../contract'
import { type DaemonHost, DaemonRequestError } from './daemon-host'
import { defaultShell, type ShellCommand } from './default-shell'
import { scrubInheritedEnv } from './inherited-env'

export interface PtyServiceDeps {
  host: DaemonHost
  shellEnv: () => Promise<Record<string, string>>
  resolveCommand: (cmd: string) => Promise<string | null>
  settings: () => TerminalSettings
  /** Providers' inherited session markers (`terminalEnv`), removed from every spawn env. */
  inheritedEnvKeys?: () => readonly string[]
  platform: NodeJS.Platform
  exists: (p: string) => boolean
  log: Logger
}

type Cb<T> = (value: T) => void

class ListenerMap<T> {
  readonly #map = new Map<string, Set<Cb<T>>>()
  add(key: string, cb: Cb<T>): () => void {
    const set = this.#map.get(key) ?? new Set()
    this.#map.set(key, set)
    set.add(cb)
    return () => set.delete(cb)
  }
  emit(key: string, value: T): void {
    for (const cb of [...(this.#map.get(key) ?? [])]) cb(value)
  }
  clear(key: string): void {
    this.#map.delete(key)
  }
}

type ExitResult = { exitCode: number | null; signal: number | null }

const ANY = '*'
const spawnCodes = new Set<string>([PTY_SPAWN_ERROR.cwdNotFound, PTY_SPAWN_ERROR.spawnFailed])

function toSpawnError(error: unknown): PtySpawnError {
  if (error instanceof PtySpawnError) return error
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof DaemonRequestError && spawnCodes.has(error.code))
    return new PtySpawnError(error.code as PtySpawnError['code'], message)
  return new PtySpawnError(PTY_SPAWN_ERROR.unavailable, message)
}

const tagsMatch = (tags: Record<string, string>, filter: Record<string, string> = {}): boolean =>
  Object.entries(filter).every(([k, v]) => tags[k] === v)

/** `PtyService` over the pty-daemon; also the source of the IPC layer's attach/data/exit feeds. */
export class PtyServiceImpl implements PtyService {
  readonly #deps: PtyServiceDeps
  readonly #infos = new Map<string, PtyInfo>()
  readonly #exits = new Map<string, PtyExit>()
  readonly #killing = new Set<string>()
  readonly #data = new ListenerMap<PtyDataPayload>()
  readonly #input = new ListenerMap<string>()
  readonly #exitCbs = new ListenerMap<PtyExit>()
  /** Exits of ptys whose `spawn` reply is resolved but not yet registered (see `#register`). */
  readonly #earlyExits = new Map<string, ExitResult>()
  #spawning = 0

  constructor(deps: PtyServiceDeps) {
    this.#deps = deps
    deps.host.onEvent((e) => this.#onEvent(e))
    deps.host.onCrash(() => this.#onDaemonLost())
  }

  async spawn(input: PtySpawnOptions): Promise<string> {
    const opts = PtySpawnOptionsSchema.parse(input)
    try {
      const shellEnv = await this.#deps.shellEnv()
      const { command, args } = await this.#command(opts, shellEnv)
      const env: Record<string, string> = {
        ...scrubInheritedEnv({ ...shellEnv, ...opts.env }, this.#deps.inheritedEnvKeys?.() ?? []),
        TERM: TERM_NAME,
        COLORTERM: COLORTERM_VALUE,
        TERM_PROGRAM: TERM_PROGRAM_NAME,
        PWD: opts.cwd,
      }
      delete env[RUN_AS_NODE_ENV]
      const spec = {
        cwd: opts.cwd,
        command,
        args,
        env,
        scrollback: this.#deps.settings().scrollback,
        tags: opts.tags ?? {},
        cols: opts.cols,
        rows: opts.rows,
      }
      return (await this.#register(spec)).ptyId
    } catch (error) {
      throw toSpawnError(error)
    }
  }

  /**
   * Sends `spawn` and records the pty. Node emits each IPC message on its own `nextTick` and runs promise continuations
   * only after them, so when the reply and the pty's `exit` arrive in one chunk (a command that exits at once, a busy
   * machine) the exit is handled before the `await` below resumes. Such exits wait in `#earlyExits` until then.
   */
  async #register(spec: SpawnSpec): Promise<PtyInfo> {
    this.#spawning++
    try {
      const info = await this.#deps.host.request<PtyInfo>({ type: REQ.spawn, spec })
      this.#infos.set(info.ptyId, info)
      const early = this.#earlyExits.get(info.ptyId)
      if (early) this.#settleExit(info.ptyId, early)
      return info
    } finally {
      this.#spawning--
      // without a spawn in flight, what is left belongs to ptys that were already forgotten
      if (this.#spawning === 0) this.#earlyExits.clear()
    }
  }

  async #command(opts: PtySpawnOptions, shellEnv: Record<string, string>): Promise<ShellCommand> {
    const { command, args = [] } = opts
    if (command === undefined)
      return defaultShell({
        platform: this.#deps.platform,
        env: { ...process.env, ...shellEnv },
        settingShell: this.#deps.settings().shell,
        exists: this.#deps.exists,
        resolveCommand: this.#deps.resolveCommand,
      })
    const resolved = await this.#deps.resolveCommand(command)
    if (resolved === null && !PATH_SEPARATOR_RE.test(command))
      throw new PtySpawnError(PTY_SPAWN_ERROR.spawnFailed, `command not found: ${command}`)
    return { command: resolved ?? command, args }
  }

  write(ptyId: string, data: string): void {
    if (!this.#live(ptyId, REQ.write)) return
    this.#fire({ type: REQ.write, ptyId, data })
    this.#input.emit(ptyId, data)
  }

  paste(ptyId: string, text: string): void {
    if (this.#live(ptyId, REQ.paste)) this.#fire({ type: REQ.paste, ptyId, text })
  }

  isBracketedPasteEnabled(ptyId: string): boolean {
    const info = this.#infos.get(ptyId)
    return info?.status === PTY_STATUS.running && info.bracketedPaste
  }

  resize(ptyId: string, cols: number, rows: number): void {
    const info = this.#infos.get(ptyId)
    if (!info || !this.#live(ptyId, REQ.resize)) return
    this.#infos.set(ptyId, { ...info, cols, rows })
    this.#fire({ type: REQ.resize, ptyId, cols, rows })
  }

  async kill(ptyId: string, signal?: KillSignal): Promise<void> {
    if (!this.#infos.has(ptyId)) return
    this.#killing.add(ptyId)
    try {
      const info = await this.#deps.host.request<PtyInfo>({ type: REQ.kill, ptyId, signal })
      this.#settleExit(ptyId, { exitCode: info.exitCode, signal: info.signal })
    } catch (error) {
      if (!(error instanceof DaemonRequestError && error.code === DAEMON_ERROR.notFound)) throw error
    } finally {
      this.#forget(ptyId)
    }
  }

  onData(ptyId: string, cb: (data: string) => void): () => void {
    return this.#data.add(ptyId, (e) => cb(e.data))
  }

  onInput(ptyId: string, cb: (data: string) => void): () => void {
    return this.#input.add(ptyId, cb)
  }

  onExit(ptyId: string, cb: (exit: PtyExit) => void): () => void {
    const stored = this.#exits.get(ptyId)
    if (!stored) return this.#exitCbs.add(ptyId, cb)
    let active = true
    queueMicrotask(() => {
      if (active) cb(stored)
    })
    return () => {
      active = false
    }
  }

  getShellEnv(): Promise<Record<string, string>> {
    return this.#deps.shellEnv()
  }

  get(ptyId: string): PtyInfo | undefined {
    const info = this.#infos.get(ptyId)
    return info && { ...info }
  }

  list(filter?: { tags?: Record<string, string> }): PtyInfo[] {
    return [...this.#infos.values()].filter((i) => tagsMatch(i.tags, filter?.tags)).map((i) => ({ ...i }))
  }

  snapshot(ptyId: string): Promise<PtySnapshot> {
    return this.#deps.host.request<PtySnapshot>({ type: REQ.snapshot, ptyId })
  }

  /** Every pty's output (with its sequence number), for the IPC feed. */
  onAnyData(cb: (e: PtyDataPayload) => void): () => void {
    return this.#data.add(ANY, cb)
  }

  onAnyExit(cb: (exit: PtyExit) => void): () => void {
    return this.#exitCbs.add(ANY, cb)
  }

  /** Info + snapshot for a renderer view; the buffer of a pty lost in a daemon crash reads as empty. */
  async attach(ptyId: string): Promise<PtyAttachResult> {
    const info = this.#infos.get(ptyId)
    if (!info) return { found: false }
    const empty: PtySnapshot = { data: '', seq: 0, cols: info.cols, rows: info.rows }
    const snapshot = await this.snapshot(ptyId).catch(() => empty)
    return { found: true, info: { ...info }, snapshot, exit: this.#exits.get(ptyId) ?? null }
  }

  readText(ptyId: string): Promise<string> {
    return this.#deps.host.request<string>({ type: REQ.readText, ptyId })
  }

  #live(ptyId: string, what: string): boolean {
    if (this.#infos.get(ptyId)?.status === PTY_STATUS.running) return true
    this.#deps.log.debug(`terminal: ${what} on unknown or exited pty ${ptyId} ignored`)
    return false
  }

  #fire(req: Parameters<DaemonHost['request']>[0]): void {
    this.#deps.host.request(req).catch((error: unknown) => this.#deps.log.warn(`terminal: ${req.type} failed`, error))
  }

  #onEvent(e: DaemonEvent): void {
    switch (e.kind) {
      case MSG.data: {
        const payload = { ptyId: e.ptyId, seq: e.seq, data: e.data }
        this.#data.emit(e.ptyId, payload)
        this.#data.emit(ANY, payload)
        return
      }
      case MSG.modes: {
        const info = this.#infos.get(e.ptyId)
        if (info) this.#infos.set(e.ptyId, { ...info, bracketedPaste: e.bracketedPaste })
        return
      }
      case MSG.exit: {
        const result = { exitCode: e.exitCode, signal: e.signal }
        if (!this.#infos.has(e.ptyId) && this.#spawning > 0) this.#earlyExits.set(e.ptyId, result)
        else this.#settleExit(e.ptyId, result)
        return
      }
      case MSG.ready:
        return
      default: {
        const never: never = e
        this.#deps.log.warn('terminal: unknown daemon event', never)
      }
    }
  }

  /** Records an exit once (reason `killed` while a kill is in flight) and notifies listeners. */
  #settleExit(ptyId: string, result: ExitResult, reason?: PtyExit['reason']): void {
    const info = this.#infos.get(ptyId)
    // unknown here: forgotten after `kill` (exits racing a spawn reply are held back by `#register`)
    if (!info || this.#exits.has(ptyId)) return
    this.#infos.set(ptyId, { ...info, status: PTY_STATUS.exited, ...result })
    const why = reason ?? (this.#killing.has(ptyId) ? PTY_EXIT_REASON.killed : PTY_EXIT_REASON.exited)
    const exit: PtyExit = { ptyId, ...result, reason: why }
    this.#exits.set(ptyId, exit)
    this.#exitCbs.emit(ptyId, exit)
    this.#exitCbs.emit(ANY, exit)
    this.#exitCbs.clear(ptyId)
  }

  #onDaemonLost(): void {
    for (const [ptyId, info] of this.#infos)
      if (info.status === PTY_STATUS.running)
        this.#settleExit(ptyId, { exitCode: null, signal: null }, PTY_EXIT_REASON.daemonRestarted)
  }

  #forget(ptyId: string): void {
    this.#infos.delete(ptyId)
    this.#exits.delete(ptyId)
    this.#killing.delete(ptyId)
    this.#data.clear(ptyId)
    this.#input.clear(ptyId)
    this.#exitCbs.clear(ptyId)
  }
}
