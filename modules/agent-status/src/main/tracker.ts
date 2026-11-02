import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { type AgentStatusEvent, type SessionStatusInfo, STATUS_SOURCE, type StatusSessionMonitor } from '../contract'
import type { Clock } from './clock'
import {
  ACTIVITY,
  INPUT_SOURCE,
  initialTrackedState,
  LIFECYCLE,
  reduceStatus,
  type TrackedState,
  type TrackerInput,
} from './state-machine'

export interface TrackerTimings {
  hookGraceMs: number
  activityIdleMs: number
}
export type StatusSource = SessionStatusInfo['source']

export interface TrackerOptions {
  sessionId: string
  worktreeId: string
  source: StatusSource
  timings: TrackerTimings
  clock: Clock
  onChange(next: TrackedState, prev: TrackedState): void
  onGraceExpired?(): void
}

/**
 * One session's status: hook events when they arrive; otherwise, after `hookGraceMs` without any, terminal activity
 * (output → working, `activityIdleMs` of silence → idle).
 */
export class SessionTracker {
  readonly sessionId: string
  readonly worktreeId: string
  #state: TrackedState = initialTrackedState
  #source: StatusSource
  #timings: TrackerTimings
  readonly #opts: TrackerOptions
  #graceTimer: unknown
  #idleTimer: unknown
  #monitor: StatusSessionMonitor | undefined

  constructor(opts: TrackerOptions) {
    this.#opts = opts
    this.sessionId = opts.sessionId
    this.worktreeId = opts.worktreeId
    this.#source = opts.source
    this.#timings = { ...opts.timings }
    if (this.#source === STATUS_SOURCE.pendingHooks) this.#startGrace()
  }

  get state(): TrackedState {
    return this.#state
  }

  get source(): StatusSource {
    return this.#source
  }

  applyEvent(event: AgentStatusEvent): void {
    if (this.#source !== STATUS_SOURCE.external) this.#source = STATUS_SOURCE.hooks
    this.#clearTimers()
    this.#apply({ source: INPUT_SOURCE.hook, event })
  }

  /** The provider's session monitor (see `StatusCapability.monitorSession`), if one was attached. */
  get monitor(): StatusSessionMonitor | undefined {
    return this.#monitor
  }

  /** Owns `monitor` from now on: it is disposed with the tracker or when the session exits. */
  attachMonitor(monitor: StatusSessionMonitor): void {
    this.#disposeMonitor()
    if (this.#exited) monitor.dispose()
    else this.#monitor = monitor
  }

  noteInterruptKey(): void {
    this.#monitor?.onInterruptKey?.()
  }

  noteOutput(): void {
    this.#monitor?.onOutput?.()
    if (this.#source !== STATUS_SOURCE.activity || this.#exited) return
    this.#apply({ source: INPUT_SOURCE.activity, kind: ACTIVITY.output })
    this.#clearIdle()
    this.#idleTimer = this.#opts.clock.setTimeout(() => {
      this.#idleTimer = undefined
      this.#apply({ source: INPUT_SOURCE.activity, kind: ACTIVITY.silence })
    }, this.#timings.activityIdleMs)
  }

  setSource(source: typeof STATUS_SOURCE.external): void {
    this.#source = source
    this.#clearTimers()
  }

  markExited(): void {
    this.#clearTimers()
    this.#disposeMonitor()
    this.#apply({ source: INPUT_SOURCE.lifecycle, kind: LIFECYCLE.exited })
  }

  markFailed(): void {
    this.#clearTimers()
    this.#apply({ source: INPUT_SOURCE.lifecycle, kind: LIFECYCLE.failed })
  }

  setTimings(t: Partial<TrackerTimings>): void {
    this.#timings = { ...this.#timings, ...t }
  }

  dispose(): void {
    this.#clearTimers()
    this.#disposeMonitor()
  }

  get #exited(): boolean {
    return this.#state.status === SESSION_STATUS.exited
  }

  #apply(input: TrackerInput): void {
    const prev = this.#state
    const next = reduceStatus(prev, input)
    if (next === prev) return
    this.#state = next
    this.#opts.onChange(next, prev)
  }

  #startGrace(): void {
    this.#graceTimer = this.#opts.clock.setTimeout(() => {
      this.#graceTimer = undefined
      if (this.#source !== STATUS_SOURCE.pendingHooks) return
      this.#source = STATUS_SOURCE.activity
      this.#opts.onGraceExpired?.()
    }, this.#timings.hookGraceMs)
  }

  #disposeMonitor(): void {
    const monitor = this.#monitor
    this.#monitor = undefined
    monitor?.dispose()
  }

  #clearIdle(): void {
    if (this.#idleTimer !== undefined) this.#opts.clock.clearTimeout(this.#idleTimer)
    this.#idleTimer = undefined
  }

  #clearTimers(): void {
    if (this.#graceTimer !== undefined) this.#opts.clock.clearTimeout(this.#graceTimer)
    this.#graceTimer = undefined
    this.#clearIdle()
  }
}
