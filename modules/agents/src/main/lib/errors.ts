import { AGENTS_ERROR, AgentsError, type AgentsErrorCode, SESSION_STATUS } from '../../contract'
import type { StorePatch } from '../sessions/sessions-store'

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** An `AgentsError` as is; anything else becomes `fallback { message }`. */
export function toAgentsError(e: unknown, fallback: AgentsErrorCode = AGENTS_ERROR.spawnFailed): AgentsError {
  return e instanceof AgentsError ? e : new AgentsError(fallback, { message: messageOf(e) })
}

/** The row patch of a session that failed to start (used by start and relaunch). */
export const errorSessionPatch = (e: AgentsError, now: number): StorePatch => ({
  status: SESSION_STATUS.error,
  errorCode: e.code,
  errorMessage: e.message,
  endedAt: now,
})
