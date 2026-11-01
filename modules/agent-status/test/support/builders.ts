import type { AgentStatusEvent, SessionStatusInfo, StatusEventKind } from '../../src/contract'
import { initialTrackedState, type TrackedState } from '../../src/main/state-machine'

export const sessionInfo = (over: Partial<SessionStatusInfo> = {}): SessionStatusInfo => ({
  sessionId: 's1',
  worktreeId: 'w1',
  status: 'starting',
  turnCompleted: false,
  source: 'pending-hooks',
  unread: false,
  updatedAt: 0,
  ...over,
})

export const trackedState = (over: Partial<TrackedState> = {}): TrackedState => ({ ...initialTrackedState, ...over })

/** A status event of `kind` with sensible required fields. */
export const event = (kind: StatusEventKind, extra: Record<string, unknown> = {}): AgentStatusEvent =>
  ({ kind, ...(kind === 'waitingForUser' ? { reason: 'permission' } : {}), ...extra }) as AgentStatusEvent
