import {
  type AgentStatusEvent,
  EVENT_KIND as K,
  type StatusMonitorContext,
  type StatusSessionMonitor,
} from '@pragma/module-agent-status/contract'
import { CLAUDE_TRANSCRIPT as T } from './constants'
import { readClaudeHookPayload } from './hook-events'
import { type TranscriptFs, TranscriptTail } from './transcript-tail'

export interface MonitorClock {
  now(): number
  setTimeout(fn: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

export interface InterruptMonitorDeps {
  fs: TranscriptFs
  clock: MonitorClock
  timings?: { pollMs: number; settleMs: number }
}

const PHASE = { idle: 'idle', working: 'working', waiting: 'waiting' } as const
type Phase = (typeof PHASE)[keyof typeof PHASE]

/** The turn phase an event leads to; undefined = unchanged. */
function phaseAfter(kind: AgentStatusEvent['kind']): Phase | undefined {
  switch (kind) {
    case K.promptSubmitted:
    case K.toolStarted:
    case K.toolFinished:
    case K.userResponded:
      return PHASE.working
    case K.waitingForUser:
      return PHASE.waiting
    case K.sessionStarted:
    case K.turnCompleted:
    case K.turnInterrupted:
    case K.turnFailed:
    case K.sessionEnded:
      return PHASE.idle
    default: {
      const never: never = kind
      return never
    }
  }
}

const transcriptPathOf = (raw: unknown): string | undefined => {
  const path = readClaudeHookPayload(raw)?.transcript_path
  return path?.endsWith(T.extension) ? path : undefined
}

/**
 * Claude Code fires no hook when the user interrupts a turn (Esc, Ctrl-C), so the hooks leave the session
 * `working`. While a turn runs this monitor checks the session transcript (path from the hook payloads) every
 * `pollMs` and reports `turnInterrupted` when:
 * - Claude wrote its interrupt marker (`[Request interrupted by user…]`) after the turn started, or
 * - (Claude's "put the prompt back" case, which may leave no marker) the user pressed Esc/Ctrl-C while `working`,
 *   no hook event followed, the terminal has been quiet for `settleMs` since (the spinner stopped), and the
 *   transcript shows no answer of the model in this turn. A keystroke alone never ends a turn.
 * Only event kinds leave this object; transcript content is never kept or forwarded.
 */
export class ClaudeInterruptMonitor implements StatusSessionMonitor {
  readonly #ctx: StatusMonitorContext
  readonly #deps: InterruptMonitorDeps
  readonly #timings: { pollMs: number; settleMs: number }
  #phase: Phase = PHASE.idle
  #path: string | undefined
  #tail: Promise<TranscriptTail> | undefined
  /** Bumped per turn: async results of an older turn are dropped. */
  #turn = 0
  #progressed = false
  #keyAt: number | undefined
  #lastOutputAt = Number.NEGATIVE_INFINITY
  #timer: unknown
  #disposed = false

  constructor(ctx: StatusMonitorContext, deps: InterruptMonitorDeps) {
    this.#ctx = ctx
    this.#deps = deps
    this.#timings = deps.timings ?? { pollMs: T.pollMs, settleMs: T.settleMs }
  }

  onHookEvent(raw: unknown, parsed: AgentStatusEvent | null): void {
    if (this.#disposed) return
    this.#keyAt = undefined
    const path = transcriptPathOf(raw)
    const pathChanged = path !== undefined && path !== this.#path
    if (path !== undefined) this.#path = path
    const next = parsed ? phaseAfter(parsed.kind) : undefined
    if (next === PHASE.idle) this.#endTurn()
    else if (next !== undefined) {
      const fresh = parsed?.kind === K.promptSubmitted || this.#phase === PHASE.idle || pathChanged
      this.#phase = next
      if (fresh) this.#startTurn()
    }
  }

  onOutput(): void {
    this.#lastOutputAt = this.#deps.clock.now()
  }

  onInterruptKey(): void {
    if (this.#phase === PHASE.working) this.#keyAt = this.#deps.clock.now()
  }

  dispose(): void {
    this.#disposed = true
    this.#endTurn()
  }

  #startTurn(): void {
    this.#stopTimer()
    this.#turn++
    this.#progressed = false
    this.#tail = this.#path ? TranscriptTail.at(this.#deps.fs, this.#path) : undefined
    this.#tail?.catch(() => undefined)
    this.#schedule()
  }

  #endTurn(): void {
    this.#stopTimer()
    this.#turn++
    this.#phase = PHASE.idle
    this.#tail = undefined
    this.#keyAt = undefined
  }

  #schedule(): void {
    if (this.#disposed || this.#phase === PHASE.idle || !this.#tail) return
    const turn = this.#turn
    this.#timer = this.#deps.clock.setTimeout(() => {
      this.#timer = undefined
      void this.#check(turn)
    }, this.#timings.pollMs)
  }

  #stopTimer(): void {
    if (this.#timer !== undefined) this.#deps.clock.clearTimeout(this.#timer)
    this.#timer = undefined
  }

  async #check(turn: number): Promise<void> {
    const scan = await this.#tail?.then((t) => t.scan()).catch(() => null)
    if (turn !== this.#turn || this.#disposed) return
    if (scan?.progressed) this.#progressed = true
    if (scan?.interrupted || (scan && this.#retractedPrompt())) {
      this.#endTurn()
      this.#ctx.report({ kind: K.turnInterrupted })
      return
    }
    this.#schedule()
  }

  /** Esc/Ctrl-C while working, nothing since, terminal quiet, and the model has not answered in this turn. */
  #retractedPrompt(): boolean {
    if (this.#phase !== PHASE.working || this.#keyAt === undefined || this.#progressed) return false
    const now = this.#deps.clock.now()
    const { settleMs } = this.#timings
    return now - this.#keyAt >= settleMs && now - this.#lastOutputAt >= settleMs
  }
}

const realClock: MonitorClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
}

export const createClaudeInterruptMonitor = (
  ctx: StatusMonitorContext,
  deps: Partial<InterruptMonitorDeps> & Pick<InterruptMonitorDeps, 'fs'>,
): ClaudeInterruptMonitor => new ClaudeInterruptMonitor(ctx, { clock: realClock, ...deps })
