import {
  type AgentStatusEvent,
  EVENT_KIND as K,
  truncateEventField,
  WAIT_REASON,
  withExternalSessionId,
} from '@pragma/module-agent-status/contract'
import { READY_RECORD, OPENCODE_EVENT_TYPES as T } from '@pragma/provider-opencode-hooks/records'

type Builder = (r: { toolName?: string; message?: string }) => AgentStatusEvent

const SIMPLE: Record<string, Builder> = {
  [READY_RECORD]: () => ({ kind: K.sessionStarted }),
  [T.sessionCreated]: () => ({ kind: K.sessionStarted }),
  [T.inboxEnqueued]: () => ({ kind: K.promptSubmitted }),
  [T.executionStarted]: () => ({ kind: K.promptSubmitted }),
  [T.toolInputStarted]: (r) => ({ kind: K.toolStarted, toolName: truncateEventField(r.toolName) }),
  [T.toolSuccess]: () => ({ kind: K.toolFinished }),
  [T.toolFailed]: () => ({ kind: K.toolFinished }),
  [T.executionSucceeded]: () => ({ kind: K.turnCompleted }),
  [T.executionInterrupted]: () => ({ kind: K.turnInterrupted }),
  [T.executionFailed]: (r) => ({ kind: K.turnFailed, message: truncateEventField(r.message) }),
  [T.permissionAsked]: () => ({ kind: K.waitingForUser, reason: WAIT_REASON.permission }),
  [T.formCreated]: () => ({ kind: K.waitingForUser, reason: WAIT_REASON.question }),
  [T.permissionReplied]: () => ({ kind: K.userResponded }),
  [T.formReplied]: () => ({ kind: K.userResponded }),
  [T.formCancelled]: () => ({ kind: K.userResponded }),
}

const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

/** Plugin record → status event; `externalSessionId` = OpenCode `sessionID` unless it is a subagent (`child`). */
export function parseOpencodeEvent(raw: unknown): AgentStatusEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const type = str(r.type)
  const build = type && Object.hasOwn(SIMPLE, type) ? SIMPLE[type] : undefined
  if (!build) return null
  const event = build({ toolName: str(r.toolName), message: str(r.message) })
  return r.child === true ? event : withExternalSessionId(event, str(r.sessionID))
}
