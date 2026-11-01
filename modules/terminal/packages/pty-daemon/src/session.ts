import { SerializeAddon } from '@xterm/addon-serialize'
import { Unicode11Addon } from '@xterm/addon-unicode11'
import xtermHeadless from '@xterm/headless'
import * as nodePty from 'node-pty'
import {
  COALESCE_MAX_BYTES,
  COALESCE_MS,
  ESCALATION_SIGNAL,
  KILL_ESCALATION_MS,
  UNICODE_VERSION,
  WIN32,
} from './constants'
import { encodePaste } from './paste'
import {
  type DaemonEvent,
  DEFAULT_KILL_SIGNAL,
  type KillSignal,
  MSG,
  PTY_STATUS,
  type PtyInfo,
  type PtySnapshot,
  type SpawnSpec,
  TERM_NAME,
} from './protocol'

const { Terminal } = xtermHeadless
type HeadlessTerminal = InstanceType<typeof Terminal>

interface Unsubscribe {
  dispose(): void
}

/** The subset of node-pty's `IPty` a session uses. */
export interface IPtyLike {
  readonly pid: number
  write(data: string): void
  resize(cols: number, rows: number): void
  kill(signal?: string): void
  onData(cb: (data: string) => void): Unsubscribe
  onExit(cb: (e: { exitCode: number; signal?: number }) => void): Unsubscribe
}

export type PtyFactory = (
  command: string,
  args: string[],
  opts: { cwd: string; env: Record<string, string>; cols: number; rows: number; name: string },
) => IPtyLike

export const nodePtyFactory: PtyFactory = (command, args, opts) => nodePty.spawn(command, args, opts)

/** node-pty reports `signal: 0` for a normal exit; a signal exit has no meaningful exit code. */
function normalizeExit(e: { exitCode: number; signal?: number }): { exitCode: number | null; signal: number | null } {
  return e.signal ? { exitCode: null, signal: e.signal } : { exitCode: e.exitCode, signal: null }
}

/** One pty: node-pty process, coalesced output, and a headless xterm mirror that produces snapshots. */
export class PtySession {
  readonly #emit: (e: DaemonEvent) => void
  readonly #pty: IPtyLike
  readonly #term: HeadlessTerminal
  readonly #serializer = new SerializeAddon()
  readonly #platform: NodeJS.Platform
  readonly #subs: Unsubscribe[] = []
  readonly #exitWaiters: ((info: PtyInfo) => void)[] = []
  #info: PtyInfo
  #pending: string[] = []
  #pendingBytes = 0
  #timer: ReturnType<typeof setTimeout> | undefined
  #escalation: ReturnType<typeof setTimeout> | undefined
  #seq = 0
  #parsedSeq = 0
  #disposed = false

  constructor(
    id: string,
    spec: SpawnSpec,
    emit: (e: DaemonEvent) => void,
    factory: PtyFactory = nodePtyFactory,
    platform: NodeJS.Platform = process.platform,
  ) {
    this.#emit = emit
    this.#platform = platform
    this.#term = new Terminal({ cols: spec.cols, rows: spec.rows, scrollback: spec.scrollback, allowProposedApi: true })
    this.#term.loadAddon(this.#serializer)
    const unicode = new Unicode11Addon()
    this.#term.loadAddon(unicode)
    this.#term.unicode.activeVersion = UNICODE_VERSION
    const { cwd, env, cols, rows } = spec
    this.#pty = factory(spec.command, spec.args, { cwd, env, cols, rows, name: TERM_NAME })
    this.#info = {
      ptyId: id,
      pid: this.#pty.pid,
      cwd,
      command: spec.command,
      args: spec.args,
      tags: spec.tags,
      cols,
      rows,
      status: PTY_STATUS.running,
      exitCode: null,
      signal: null,
      createdAt: Date.now(),
      bracketedPaste: false,
    }
    this.#subs.push(this.#pty.onData((d) => this.#onData(d)))
    this.#subs.push(this.#pty.onExit((e) => this.#onExit(e)))
  }

  get info(): PtyInfo {
    return { ...this.#info }
  }

  get #running(): boolean {
    return this.#info.status === PTY_STATUS.running && !this.#disposed
  }

  write(data: string): void {
    if (this.#running) this.#pty.write(data)
  }

  paste(text: string): void {
    this.write(encodePaste(text, this.#term.modes.bracketedPasteMode))
  }

  resize(cols: number, rows: number): void {
    if (!this.#running) return
    this.#flush()
    this.#pty.resize(cols, rows)
    this.#term.resize(cols, rows)
    this.#info = { ...this.#info, cols, rows }
  }

  /** Sends `signal` (escalating to SIGKILL) and resolves with the info of the confirmed exit. */
  kill(signal: KillSignal = DEFAULT_KILL_SIGNAL): Promise<PtyInfo> {
    if (this.#info.status === PTY_STATUS.exited) return Promise.resolve(this.info)
    const exited = new Promise<PtyInfo>((resolve) => this.#exitWaiters.push(resolve))
    this.#signal(signal)
    if (this.#escalation === undefined)
      this.#escalation = setTimeout(() => this.#signal(ESCALATION_SIGNAL), KILL_ESCALATION_MS)
    return exited
  }

  async snapshot(): Promise<PtySnapshot> {
    await this.#parsed()
    const { cols, rows } = this.#term
    return {
      data: this.#serializer.serialize({ scrollback: this.#term.options.scrollback }),
      seq: this.#parsedSeq,
      cols,
      rows,
    }
  }

  async readText(): Promise<string> {
    await this.#parsed()
    const buffer = this.#term.buffer.active
    const lines: string[] = []
    for (let i = 0; i < buffer.length; i++) lines.push(buffer.getLine(i)?.translateToString(true) ?? '')
    while (lines.length > 0 && lines.at(-1) === '') lines.pop()
    return lines.join('\n')
  }

  dispose(): void {
    if (this.#disposed) return
    if (this.#info.status === PTY_STATUS.running) this.#signal(ESCALATION_SIGNAL)
    this.#disposed = true
    clearTimeout(this.#timer)
    clearTimeout(this.#escalation)
    for (const s of this.#subs) s.dispose()
    this.#term.dispose()
  }

  #signal(signal: string): void {
    try {
      if (this.#platform === WIN32) this.#pty.kill()
      else this.#pty.kill(signal)
    } catch {
      // the process is already gone; its exit event follows
    }
  }

  /** Flushes, then waits until the headless terminal parsed everything written so far. */
  #parsed(): Promise<void> {
    this.#flush()
    return new Promise((resolve) => this.#term.write('', resolve))
  }

  #onData(data: string): void {
    if (this.#disposed) return
    this.#pending.push(data)
    this.#pendingBytes += Buffer.byteLength(data)
    if (this.#pendingBytes >= COALESCE_MAX_BYTES) this.#flush()
    else this.#timer ??= setTimeout(() => this.#flush(), COALESCE_MS)
  }

  #flush(): void {
    clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.#pending.length === 0 || this.#disposed) return
    const data = this.#pending.join('')
    this.#pending = []
    this.#pendingBytes = 0
    const seq = ++this.#seq
    this.#term.write(data, () => this.#afterParse(seq))
    this.#emit({ kind: MSG.data, ptyId: this.#info.ptyId, seq, data })
  }

  #afterParse(seq: number): void {
    this.#parsedSeq = seq
    if (this.#disposed) return
    const bracketedPaste = this.#term.modes.bracketedPasteMode
    if (bracketedPaste === this.#info.bracketedPaste) return
    this.#info = { ...this.#info, bracketedPaste }
    this.#emit({ kind: MSG.modes, ptyId: this.#info.ptyId, bracketedPaste })
  }

  #onExit(e: { exitCode: number; signal?: number }): void {
    this.#flush()
    clearTimeout(this.#escalation)
    this.#info = { ...this.#info, status: PTY_STATUS.exited, ...normalizeExit(e) }
    const { ptyId, exitCode, signal } = this.#info
    this.#emit({ kind: MSG.exit, ptyId, exitCode, signal })
    for (const resolve of this.#exitWaiters.splice(0)) resolve(this.info)
  }
}
