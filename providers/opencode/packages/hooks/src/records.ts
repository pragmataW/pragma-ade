// Portions adapted from onurravli/voltran (packages/daemon/src/opencode-plugin/index.ts): the child-session filter
// and event selection. Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0).
import { OPENCODE_EVENT_TYPES as T, USER_ITEM_TYPE } from './constants'

export { OPENCODE_EVENT_TYPES, READY_RECORD } from './constants'

/** What the plugin forwards (`agent.hookEvent` → `event`); parsed by the capability's `parseOpencodeEvent`. */
export interface OpencodeRecord {
  type: string
  sessionID?: string
  toolName?: string
  message?: string
  child?: true
}

type Data = Record<string, unknown>
const obj = (v: unknown): Data => (v && typeof v === 'object' ? (v as Data) : {})
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const SESSION_EVENTS = new Set<string>([
  T.sessionCreated,
  T.executionStarted,
  T.executionSucceeded,
  T.executionInterrupted,
  T.toolSuccess,
  T.toolFailed,
])
/** Shown for subagent sessions too (they block the parent). */
const PROMPT_EVENTS = new Set<string>([T.permissionAsked, T.permissionReplied, T.formReplied, T.formCancelled])

function recordFor(type: string, data: Data): OpencodeRecord | null {
  const sessionID = str(data.sessionID)
  if (SESSION_EVENTS.has(type) || PROMPT_EVENTS.has(type)) return { type, sessionID }
  if (type === T.inboxEnqueued) return str(obj(data.item).type) === USER_ITEM_TYPE ? { type, sessionID } : null
  if (type === T.executionFailed) return { type, sessionID, message: str(obj(data.error).message) }
  if (type === T.toolInputStarted) return { type, sessionID, toolName: str(data.name) }
  if (type === T.formCreated) return { type, sessionID: str(obj(data.form).sessionID) }
  return null
}

const isPrompt = (type: string): boolean => PROMPT_EVENTS.has(type) || type === T.formCreated

/** Maps bus events to records; remembers subagent (child) sessions and drops their non-prompt events. */
export function createRecordMapper(): (ev: { type: string; data?: unknown }) => OpencodeRecord | null {
  const children = new Set<string>()
  return (ev) => {
    const data = obj(ev.data)
    if (ev.type === T.sessionCreated && data.parentID) {
      const id = str(data.sessionID)
      if (id) children.add(id)
      return null
    }
    const record = recordFor(ev.type, data)
    if (!record?.sessionID || !children.has(record.sessionID)) return record
    return isPrompt(record.type) ? { ...record, child: true } : null
  }
}
