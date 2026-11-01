import { type AgentSessionsService, SESSION_STATUS } from '@pragma/module-agents/contract'
import type { Logger } from '@pragma/sdk'
import {
  type AgentSessionStatusChangedPayload,
  type AgentStatus,
  type SessionStatusInfo,
  STATUS_SOURCE,
  type WorktreeStatusInfo,
} from '../contract'
import { shouldMarkUnread, summarize } from '../lib/status-rules'
import type { Clock } from './clock'
import type { TrackedState } from './state-machine'
import { SessionTracker, type StatusSource, type TrackerTimings } from './tracker'

export interface StatusStoreDeps {
  agents: Pick<AgentSessionsService, 'updateSession'>
  emitStatusChanged(p: AgentSessionStatusChangedPayload): void
  publish: { session(i: SessionStatusInfo): void; worktree(i: WorktreeStatusInfo): void }
  activeWorktreeId(): string | null
  clock: Clock
  timings(): TrackerTimings
  onTransition?(info: SessionStatusInfo, prev: AgentStatus): void
  log: Pick<Logger, 'warn'>
}

interface Meta {
  unread: boolean
  updatedAt: number
}

const statusKeyChanged = (a: TrackedState, b: TrackedState): boolean =>
  a.status !== b.status || a.externalSessionId !== b.externalSessionId

/** Every tracked session of this app run: trackers, unread flags, persistence and announcements. */
export class StatusStore {
  readonly #deps: StatusStoreDeps
  readonly #trackers = new Map<string, SessionTracker>()
  readonly #meta = new Map<string, Meta>()
  readonly #writes = new Map<string, Promise<void>>()

  constructor(deps: StatusStoreDeps) {
    this.#deps = deps
  }

  /** Idempotent: a tracked session keeps its tracker, unless it exited (a relaunch starts a fresh one). */
  track(o: { sessionId: string; worktreeId: string; source: StatusSource }): SessionTracker {
    const existing = this.#trackers.get(o.sessionId)
    if (existing && existing.state.status !== SESSION_STATUS.exited) return existing
    existing?.dispose()
    const timings = this.#deps.timings()
    const tracker: SessionTracker = new SessionTracker({
      ...o,
      timings,
      clock: this.#deps.clock,
      onChange: (next, prev) => this.#changed(tracker, next, prev),
      onGraceExpired: () =>
        this.#deps.log.warn(
          `no status hooks received within ${timings.hookGraceMs} ms for session ${o.sessionId}; using terminal activity`,
        ),
    })
    this.#trackers.set(o.sessionId, tracker)
    this.#meta.set(o.sessionId, { unread: false, updatedAt: this.#deps.clock.now() })
    this.#deps.publish.session(this.#info(tracker))
    this.#deps.publish.worktree(this.worktree(o.worktreeId))
    return tracker
  }

  get(sessionId: string): SessionTracker | undefined {
    return this.#trackers.get(sessionId)
  }

  info(sessionId: string): SessionStatusInfo | null {
    const t = this.#trackers.get(sessionId)
    return t ? this.#info(t) : null
  }

  list(): SessionStatusInfo[] {
    return [...this.#trackers.values()].map((t) => this.#info(t))
  }

  worktreeIds(): string[] {
    return [...new Set([...this.#trackers.values()].map((t) => t.worktreeId))]
  }

  worktree(worktreeId: string): WorktreeStatusInfo {
    return { worktreeId, ...summarize(this.list().filter((s) => s.worktreeId === worktreeId)) }
  }

  markWorktreeRead(worktreeId: string): void {
    let changed = false
    for (const t of this.#trackers.values()) {
      const meta = this.#meta.get(t.sessionId)
      if (t.worktreeId !== worktreeId || !meta?.unread) continue
      meta.unread = false
      changed = true
      this.#deps.publish.session(this.#info(t))
    }
    if (changed) this.#deps.publish.worktree(this.worktree(worktreeId))
  }

  exited(sessionId: string): void {
    this.#trackers.get(sessionId)?.markExited()
  }

  /** A closed session leaves the store (its tab is gone). */
  forget(sessionId: string): void {
    const t = this.#trackers.get(sessionId)
    if (!t) return
    t.dispose()
    this.#trackers.delete(sessionId)
    this.#meta.delete(sessionId)
    this.#deps.publish.worktree(this.worktree(t.worktreeId))
  }

  setTimings(t: Partial<TrackerTimings>): void {
    for (const tracker of this.#trackers.values()) tracker.setTimings(t)
  }

  /** Resolves when every queued `updateSession` call settled (tests, shutdown). */
  async flush(): Promise<void> {
    await Promise.all(this.#writes.values())
  }

  dispose(): void {
    for (const t of this.#trackers.values()) t.dispose()
  }

  #info(t: SessionTracker): SessionStatusInfo {
    const { status, turnCompleted, externalSessionId, detail } = t.state
    const meta = this.#meta.get(t.sessionId) ?? { unread: false, updatedAt: 0 }
    return {
      sessionId: t.sessionId,
      worktreeId: t.worktreeId,
      status,
      turnCompleted,
      source: t.source,
      ...(externalSessionId === undefined ? {} : { externalSessionId }),
      ...(detail === undefined ? {} : { detail }),
      unread: meta.unread,
      updatedAt: meta.updatedAt,
    }
  }

  #changed(t: SessionTracker, next: TrackedState, prev: TrackedState): void {
    const meta = this.#meta.get(t.sessionId)
    if (!meta) return
    meta.updatedAt = this.#deps.clock.now()
    const selected = this.#deps.activeWorktreeId() === t.worktreeId
    if (shouldMarkUnread(prev.status, next.status, selected)) meta.unread = true
    if (statusKeyChanged(prev, next)) {
      this.#persist(t, next)
      const { status, externalSessionId } = next
      this.#deps.emitStatusChanged({
        sessionId: t.sessionId,
        status,
        ...(externalSessionId ? { externalSessionId } : {}),
      })
    }
    const info = this.#info(t)
    this.#deps.publish.session(info)
    this.#deps.publish.worktree(this.worktree(t.worktreeId))
    this.#deps.onTransition?.(info, prev.status)
  }

  /** Serialized per session. Chat (`external`) sessions are written by 11a only; exits are written by 03. */
  #persist(t: SessionTracker, next: TrackedState): void {
    if (t.source === STATUS_SOURCE.external || next.status === SESSION_STATUS.exited) return
    const patch = {
      status: next.status,
      ...(next.externalSessionId ? { externalSessionId: next.externalSessionId } : {}),
    }
    const prev = this.#writes.get(t.sessionId) ?? Promise.resolve()
    const write = prev
      .then(() => this.#deps.agents.updateSession(t.sessionId, patch))
      .then(
        () => undefined,
        (e: unknown) => this.#deps.log.warn(`agent-status: updateSession(${t.sessionId}) failed`, e),
      )
    this.#writes.set(t.sessionId, write)
  }
}
