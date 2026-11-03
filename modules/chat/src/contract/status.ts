import { type AgentSessionStatus, SESSION_STATUS as S } from '@pragma/module-agents/contract'
import { EVENT_KIND as K, SESSION_EXIT_REASON } from './constants'
import type { ChatEvent } from './events'

/** Re-used from 03 (same six values), not redefined. */
export type ChatSessionStatus = AgentSessionStatus

const ACTIVE = new Set<ChatSessionStatus>([S.working, S.waiting])

/** After an answered interaction: still waiting while others are open, else back to work. */
const afterInteraction = (prev: ChatSessionStatus, pending: number): ChatSessionStatus => {
  if (pending > 0) return S.waiting
  return prev === S.waiting ? S.working : prev
}

/**
 * The session status after `e`; `pendingInteractions` = open permission requests + open `awaitsResponse` custom
 * events after `e` was applied.
 */
export function nextStatus(
  prev: ChatSessionStatus,
  e: ChatEvent,
  ctx: { pendingInteractions: number },
): ChatSessionStatus {
  switch (e.kind) {
    case K.sessionInfo:
      return prev === S.starting ? S.idle : prev
    case K.turnStart:
      return S.working
    case K.permissionRequest:
    case K.question:
    case K.planProposal:
      return S.waiting
    case K.permissionResolved:
    case K.responseResolved:
      return afterInteraction(prev, ctx.pendingInteractions)
    case K.custom:
      return e.awaitsResponse ? S.waiting : prev
    case K.turnEnd:
      return ACTIVE.has(prev) ? S.idle : prev
    case K.sessionExit:
      return e.reason === SESSION_EXIT_REASON.startup_failed ? S.error : S.exited
    case K.error:
      return e.fatal ? S.error : prev
    case K.options:
    case K.message:
    case K.textDelta:
    case K.thinking:
    case K.toolCall:
    case K.toolResult:
    case K.fileEdit:
    case K.todo:
    case K.usage:
    case K.queue:
    case K.task:
    case K.mcpStatus:
    case K.rateLimit:
    case K.retry:
    case K.messageAck:
    case K.transcriptTruncate:
      return prev
    default: {
      const never: never = e
      return never
    }
  }
}
