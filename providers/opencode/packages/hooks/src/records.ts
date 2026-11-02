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

const EXECUTION_ENDS = [T.executionSucceeded, T.executionFailed, T.executionInterrupted]

/**
 * Running executions and queued user prompts per session. A prompt taken back from the inbox before it ran
 * (`session.inbox.cancelled`) ends no execution, so without this the session would stay `working`. Returns, per
 * event, whether it withdrew the last queued prompt of a session that runs nothing.
 */
function createTurnTracker(): (type: string, data: Data) => boolean {
  const running = new Set<string>()
  const queued = new Map<string, Set<string>>()
  const inbox = (s: string): Set<string> => {
    const set = queued.get(s) ?? new Set<string>()
    queued.set(s, set)
    return set
  }
  const isUser = (d: Data) => str(obj(d.item).type) === USER_ITEM_TYPE
  type Ids = { session: string; inboxId: string; data: Data }
  const NOT_WITHDRAWN = false
  const ended = ({ session }: Ids) => {
    running.delete(session)
    return NOT_WITHDRAWN
  }
  const handlers: Record<string, (ids: Ids) => boolean> = {
    ...Object.fromEntries(EXECUTION_ENDS.map((t) => [t, ended])),
    [T.executionStarted]: ({ session }) => {
      running.add(session)
      return NOT_WITHDRAWN
    },
    [T.inboxEnqueued]: ({ session, inboxId, data }) => {
      if (isUser(data)) inbox(session).add(inboxId)
      return NOT_WITHDRAWN
    },
    [T.inboxDelivered]: ({ session, inboxId }) => {
      inbox(session).delete(inboxId)
      return NOT_WITHDRAWN
    },
    [T.inboxCancelled]: ({ session, inboxId }) =>
      inbox(session).delete(inboxId) && !running.has(session) && inbox(session).size === 0,
  }
  return (type, data) => {
    const handle = Object.hasOwn(handlers, type) ? handlers[type] : undefined
    return handle?.({ session: str(data.sessionID) ?? '', inboxId: str(data.inboxID) ?? '', data }) ?? NOT_WITHDRAWN
  }
}

function recordFor(type: string, data: Data, withdrawn: boolean): OpencodeRecord | null {
  const sessionID = str(data.sessionID)
  if (SESSION_EVENTS.has(type) || PROMPT_EVENTS.has(type)) return { type, sessionID }
  if (type === T.inboxCancelled) return withdrawn ? { type, sessionID } : null
  if (type === T.inboxEnqueued) return str(obj(data.item).type) === USER_ITEM_TYPE ? { type, sessionID } : null
  if (type === T.executionFailed) return { type, sessionID, message: str(obj(data.error).message) }
  if (type === T.toolInputStarted) return { type, sessionID, toolName: str(data.name) }
  if (type === T.formCreated) return { type, sessionID: str(obj(data.form).sessionID) }
  return null
}

const isPrompt = (type: string): boolean => PROMPT_EVENTS.has(type) || type === T.formCreated

/**
 * Maps bus events to records; remembers subagent (child) sessions and drops their non-prompt events, and tracks
 * executions and queued prompts (see `createTurnTracker`).
 */
export function createRecordMapper(): (ev: { type: string; data?: unknown }) => OpencodeRecord | null {
  const children = new Set<string>()
  const noteTurn = createTurnTracker()
  return (ev) => {
    const data = obj(ev.data)
    const withdrawn = noteTurn(ev.type, data)
    if (ev.type === T.sessionCreated && data.parentID) {
      const id = str(data.sessionID)
      if (id) children.add(id)
      return null
    }
    const record = recordFor(ev.type, data, withdrawn)
    if (!record?.sessionID || !children.has(record.sessionID)) return record
    return isPrompt(record.type) ? { ...record, child: true } : null
  }
}
