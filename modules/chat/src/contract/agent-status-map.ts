import {
  type AgentStatusEvent,
  EVENT_KIND as S,
  truncateEventField,
  WAIT_REASON,
  withExternalSessionId,
} from '@pragma/module-agent-status/contract'
import { EVENT_KIND as K, TOOL_STATUS, TURN_END_REASON } from './constants'
import type { ChatEvent } from './events'

/** The agent-status event, without `externalSessionId`, for a chat event (null = nothing to report). */
function baseEvent(e: ChatEvent, lastError: string | undefined): AgentStatusEvent | null {
  switch (e.kind) {
    case K.sessionInfo:
      return e.externalSessionId ? { kind: S.sessionStarted } : null
    case K.turnStart:
      return { kind: S.promptSubmitted }
    case K.toolCall:
      return e.status === TOOL_STATUS.running ? { kind: S.toolStarted, toolName: truncateEventField(e.name) } : null
    case K.toolResult:
      return { kind: S.toolFinished }
    case K.permissionRequest:
      return { kind: S.waitingForUser, reason: WAIT_REASON.permission }
    case K.custom:
      return e.awaitsResponse ? { kind: S.waitingForUser, reason: WAIT_REASON.question } : null
    case K.question:
    case K.planProposal:
      return { kind: S.waitingForUser, reason: WAIT_REASON.question }
    case K.permissionResolved:
    case K.responseResolved:
      return { kind: S.userResponded }
    case K.turnEnd:
      return turnEndEvent(e.reason, lastError)
    case K.sessionExit:
      return { kind: S.sessionEnded }
    case K.options:
    case K.message:
    case K.textDelta:
    case K.thinking:
    case K.fileEdit:
    case K.todo:
    case K.usage:
    case K.error:
    case K.queue:
    case K.task:
    case K.mcpStatus:
    case K.rateLimit:
    case K.retry:
      return null
    default: {
      const never: never = e
      return never
    }
  }
}

function turnEndEvent(reason: (typeof TURN_END_REASON)[keyof typeof TURN_END_REASON], lastError?: string) {
  switch (reason) {
    case TURN_END_REASON.completed:
    case TURN_END_REASON.limit:
      return { kind: S.turnCompleted }
    case TURN_END_REASON.interrupted:
      return { kind: S.turnInterrupted }
    case TURN_END_REASON.error:
      return { kind: S.turnFailed, message: truncateEventField(lastError) }
    default: {
      const never: never = reason
      return never
    }
  }
}

/**
 * Pure chat → agent-status mapping (04 drives dots, unread state and notifications from it; 11a alone writes the
 * session status). `lastError` is the latest error text of the session, used for `turnFailed.message`, cut to 04's
 * field limit.
 */
export function toAgentStatusEvent(
  e: ChatEvent,
  externalSessionId?: string,
  lastError?: string,
): AgentStatusEvent | null {
  const base = baseEvent(e, lastError)
  return base ? withExternalSessionId(base as AgentStatusEvent, externalSessionId) : null
}
