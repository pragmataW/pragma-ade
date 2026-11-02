import { keyedEnum } from '@pragma/module-agents/contract'
import { SESSION_AVAILABILITIES } from '../../constants'
import type { LinkedSessionDto } from '../../contract'

export type SessionAvailability = (typeof SESSION_AVAILABILITIES)[number]
export const SESSION_AVAILABILITY = keyedEnum(SESSION_AVAILABILITIES)

/**
 * A linked worktree that 01 no longer lists (removed or archived). An empty map means 01's renderer store has not
 * loaded yet, so nothing counts as removed.
 */
export const isWorktreeGone = (worktreeId: string | null, worktrees: ReadonlyMap<string, unknown>): boolean =>
  worktreeId !== null && worktrees.size > 0 && !worktrees.has(worktreeId)

/** Go to agent works only for a session that is still open in a worktree that still exists. */
export function sessionAvailability(
  session: Pick<LinkedSessionDto, 'worktreeId' | 'ended'>,
  worktrees: ReadonlyMap<string, unknown>,
): SessionAvailability {
  if (isWorktreeGone(session.worktreeId, worktrees)) return SESSION_AVAILABILITY.worktreeRemoved
  return session.ended ? SESSION_AVAILABILITY.ended : SESSION_AVAILABILITY.open
}

/** The hover hint of a disabled Go to agent (null while the session is open). */
export const unavailableHintKey = (a: SessionAvailability): string | null =>
  a === SESSION_AVAILABILITY.open ? null : `board:sessions.unavailable.${a}`
