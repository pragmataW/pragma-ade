import { type AgentSessionStatus, SESSION_STATUS as S } from '@pragma/module-agents/contract'
import type { SessionStatusInfo, StatusSummary } from '../contract'

const URGENCY_WAITING = 5
const URGENCY_ERROR = 4
const URGENCY_WORKING = 3
const URGENCY_STARTING = 2
const URGENCY_IDLE = 1
const URGENCY_EXITED = 0

/** Worktree urgency: waiting > error > working > starting > idle > exited. */
export const STATUS_URGENCY: Record<AgentSessionStatus, number> = {
  waiting: URGENCY_WAITING,
  error: URGENCY_ERROR,
  working: URGENCY_WORKING,
  starting: URGENCY_STARTING,
  idle: URGENCY_IDLE,
  exited: URGENCY_EXITED,
}

type Summarizable = Pick<SessionStatusInfo, 'status' | 'turnCompleted' | 'unread'>

/** The most urgent status (null if empty); `turnCompleted` only when the winner is idle and every idle one is done. */
export function summarize(sessions: ReadonlyArray<Summarizable>): StatusSummary {
  let status: AgentSessionStatus | null = null
  for (const s of sessions) if (status === null || STATUS_URGENCY[s.status] > STATUS_URGENCY[status]) status = s.status
  const idle = sessions.filter((s) => s.status === S.idle)
  return {
    status,
    turnCompleted: status === S.idle && idle.every((s) => s.turnCompleted),
    unreadCount: sessions.filter((s) => s.unread).length,
    sessionCount: sessions.length,
  }
}

/** Unread when something needs attention in a worktree the user is not looking at. */
export function shouldMarkUnread(
  prev: AgentSessionStatus,
  next: AgentSessionStatus,
  worktreeSelected: boolean,
): boolean {
  if (worktreeSelected || prev === next) return false
  return next === S.waiting || (next === S.idle && (prev === S.working || prev === S.waiting))
}

/** A desktop notification once per entry into `waiting`, only while the app is in the background. */
export function shouldNotify(
  prev: AgentSessionStatus,
  next: AgentSessionStatus,
  o: { appFocused: boolean; enabled: boolean },
): boolean {
  return o.enabled && !o.appFocused && next === S.waiting && prev !== S.waiting
}
