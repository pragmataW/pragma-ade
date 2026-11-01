import { EVENT_KIND as K, TEXT_MODE, TOOL_KIND, TOOL_STATUSES, TURN_END_REASON } from './constants'
import type {
  ChatAttachmentRef,
  ChatErrorCode,
  ChatEvent,
  ChatEventEnvelope,
  ChatEventOf,
  ChatPermissionOutcome,
  ChatSlashCommand,
  ChatToolKind,
  QueuedMessage,
  UsageEvent,
} from './events'
import type { ChatOptionDescriptor } from './options'

type Body<E> = Omit<E, 'kind'>
type ToolStatus = (typeof TOOL_STATUSES)[number]

export interface MessageItem {
  kind: typeof K.message
  id: string
  role: ChatEventOf<typeof K.message>['role']
  text: string
  attachments: ChatAttachmentRef[]
}
export interface TextItem<Kind extends typeof K.textDelta | typeof K.thinking = typeof K.textDelta> {
  kind: Kind
  /** The part id. */
  id: string
  messageId: string
  text: string
  streaming: boolean
}
export type ThinkingItem = TextItem<typeof K.thinking>
export interface ToolCallItem {
  kind: typeof K.toolCall
  /** The tool call id. */
  id: string
  name: string
  toolKind: ChatToolKind
  title?: string
  input: unknown
  status: ToolStatus
  output?: string
  outputTruncated?: boolean
  error?: string
}
export type FileEditItem = Body<ChatEventOf<typeof K.fileEdit>> & { kind: typeof K.fileEdit; id: string }
export type TodoListItem = Body<ChatEventOf<typeof K.todo>> & { kind: typeof K.todo; id: string }
export type PermissionItem = Omit<Body<ChatEventOf<typeof K.permissionRequest>>, 'requestId'> & {
  kind: typeof K.permissionRequest
  /** The request id. */
  id: string
  outcome?: ChatPermissionOutcome
}
export interface ErrorItem {
  kind: typeof K.error
  id: string
  code: ChatErrorCode
  message: string
  detail?: string
}
export interface TurnEndItem {
  kind: typeof K.turnEnd
  id: string
  reason: Exclude<ChatEventOf<typeof K.turnEnd>['reason'], typeof TURN_END_REASON.completed>
}
export type SessionExitItem = Body<ChatEventOf<typeof K.sessionExit>> & {
  kind: typeof K.sessionExit
  id: string
}
export interface CustomItem {
  kind: typeof K.custom
  id: string
  type: string
  data: unknown
  eventId?: string
  awaitsResponse: boolean
  resolved?: ChatEventOf<typeof K.responseResolved>['outcome']
}

/** A rendered transcript row; `kind` equals the `ChatUiDefinition.parts` key that renders it. */
export type ChatItem =
  | MessageItem
  | TextItem
  | ThinkingItem
  | ToolCallItem
  | FileEditItem
  | TodoListItem
  | PermissionItem
  | ErrorItem
  | TurnEndItem
  | SessionExitItem
  | CustomItem
export type ChatItemKind = ChatItem['kind']

export interface ChatTranscript {
  items: ChatItem[]
  /** `itemKey(kind, id)` → index in `items`. */
  positions: Record<string, number>
  info: { externalSessionId?: string; commands: ChatSlashCommand[]; options: ChatOptionDescriptor[] }
  usage: UsageEvent | null
  queue: QueuedMessage[]
  turnActive: boolean
  turnStartedAt: number | null
  pendingInteractions: number
  lastSeq: number
}

const ID_PREFIX = {
  edit: 'edit:',
  todo: 'todo:',
  error: 'err:',
  end: 'end:',
  exit: 'exit:',
  custom: 'custom:',
} as const
const KEY_SEPARATOR = '\u0000'

export const itemKey = (kind: ChatItemKind, id: string): string => `${kind}${KEY_SEPARATOR}${id}`

export function emptyTranscript(): ChatTranscript {
  return {
    items: [],
    positions: {},
    info: { commands: [], options: [] },
    usage: null,
    queue: [],
    turnActive: false,
    turnStartedAt: null,
    pendingInteractions: 0,
    lastSeq: 0,
  }
}

function find<I extends ChatItem>(t: ChatTranscript, kind: I['kind'], id: string): I | undefined {
  const pos = t.positions[itemKey(kind, id)]
  return pos === undefined ? undefined : (t.items[pos] as I)
}

/** Replaces the item with the same kind and id, or appends it. */
function upsert(t: ChatTranscript, item: ChatItem): ChatTranscript {
  const key = itemKey(item.kind, item.id)
  const pos = t.positions[key]
  if (pos !== undefined) {
    const items = t.items.slice()
    items[pos] = item
    return { ...t, items }
  }
  return { ...t, items: [...t.items, item], positions: { ...t.positions, [key]: t.items.length } }
}

const isStreamingText = (i: ChatItem): i is TextItem | ThinkingItem =>
  (i.kind === K.textDelta || i.kind === K.thinking) && i.streaming

/** Ends every streaming text part (turn end, exit); copies `items` only when something changed. */
function stopStreaming(t: ChatTranscript): ChatTranscript {
  if (!t.items.some(isStreamingText)) return t
  return { ...t, items: t.items.map((i) => (isStreamingText(i) ? { ...i, streaming: false } : i)) }
}

function applyText(t: ChatTranscript, e: ChatEventOf<typeof K.textDelta> | ChatEventOf<typeof K.thinking>) {
  const prev = find<TextItem | ThinkingItem>(t, e.kind, e.partId)
  const snapshot = e.mode === TEXT_MODE.snapshot
  const text = snapshot || !prev ? e.text : prev.text + e.text
  return upsert(t, { kind: e.kind, id: e.partId, messageId: e.messageId, text, streaming: !snapshot } as ChatItem)
}

const TOOL_RANK: Record<ToolStatus, number> = Object.fromEntries(TOOL_STATUSES.map((s, i) => [s, i])) as Record<
  ToolStatus,
  number
>

function applyToolCall(t: ChatTranscript, e: ChatEventOf<typeof K.toolCall>): ChatTranscript {
  const prev = find<ToolCallItem>(t, K.toolCall, e.toolCallId)
  const status = prev && TOOL_RANK[prev.status] > TOOL_RANK[e.status] ? prev.status : e.status
  return upsert(t, {
    ...prev,
    kind: K.toolCall,
    id: e.toolCallId,
    name: e.name,
    toolKind: e.toolKind,
    title: e.title ?? prev?.title,
    input: e.input,
    status,
  })
}

function applyToolResult(t: ChatTranscript, e: ChatEventOf<typeof K.toolResult>): ChatTranscript {
  const prev = find<ToolCallItem>(t, K.toolCall, e.toolCallId)
  const { kind: _kind, toolCallId, ...result } = e
  const base = prev ?? { kind: K.toolCall, id: toolCallId, name: '', toolKind: TOOL_KIND.other, input: undefined }
  return upsert(t, { ...base, ...result } as ToolCallItem)
}

function applyPermission(t: ChatTranscript, e: ChatEventOf<typeof K.permissionRequest>): ChatTranscript {
  const { kind: _kind, requestId, ...rest } = e
  const isNew = !find(t, K.permissionRequest, requestId)
  const next = upsert(t, { ...rest, kind: K.permissionRequest, id: requestId })
  return isNew ? { ...next, pendingInteractions: next.pendingInteractions + 1 } : next
}

function applyPermissionResolved(t: ChatTranscript, e: ChatEventOf<typeof K.permissionResolved>): ChatTranscript {
  const prev = find<PermissionItem>(t, K.permissionRequest, e.requestId)
  if (!prev || prev.outcome) return t
  const next = upsert(t, { ...prev, outcome: e.outcome })
  return { ...next, pendingInteractions: Math.max(0, next.pendingInteractions - 1) }
}

function applyCustom(t: ChatTranscript, e: ChatEventOf<typeof K.custom>, seq: number): ChatTranscript {
  const id = e.eventId ?? `${ID_PREFIX.custom}${seq}`
  const awaitsResponse = e.awaitsResponse === true
  const isNew = !find(t, K.custom, id)
  const item: CustomItem = { kind: K.custom, id, type: e.type, data: e.data, awaitsResponse }
  if (e.eventId) item.eventId = e.eventId
  const next = upsert(t, item)
  return awaitsResponse && isNew ? { ...next, pendingInteractions: next.pendingInteractions + 1 } : next
}

function applyResponseResolved(t: ChatTranscript, e: ChatEventOf<typeof K.responseResolved>): ChatTranscript {
  const prev = find<CustomItem>(t, K.custom, e.eventId)
  if (!prev || prev.resolved) return t
  const next = upsert(t, { ...prev, resolved: e.outcome })
  return prev.awaitsResponse ? { ...next, pendingInteractions: Math.max(0, next.pendingInteractions - 1) } : next
}

function applyTurnEnd(t: ChatTranscript, e: ChatEventOf<typeof K.turnEnd>, seq: number): ChatTranscript {
  const ended = { ...stopStreaming(t), turnActive: false, turnStartedAt: null }
  if (e.reason === TURN_END_REASON.completed) return ended
  return upsert(ended, { kind: K.turnEnd, id: `${ID_PREFIX.end}${seq}`, reason: e.reason })
}

function applySessionInfo(t: ChatTranscript, e: ChatEventOf<typeof K.sessionInfo>): ChatTranscript {
  const info = { ...t.info, commands: e.commands ?? t.info.commands }
  const externalSessionId = e.externalSessionId ?? t.info.externalSessionId
  return { ...t, info: externalSessionId ? { ...info, externalSessionId } : info }
}

function apply(t: ChatTranscript, e: ChatEvent, seq: number, at: number): ChatTranscript {
  switch (e.kind) {
    case K.sessionInfo:
      return applySessionInfo(t, e)
    case K.options:
      return { ...t, info: { ...t.info, options: e.options } }
    case K.message:
      return upsert(t, { kind: K.message, id: e.messageId, role: e.role, text: e.text, attachments: e.attachments })
    case K.turnStart:
      return { ...t, turnActive: true, turnStartedAt: at }
    case K.textDelta:
    case K.thinking:
      return applyText(t, e)
    case K.toolCall:
      return applyToolCall(t, e)
    case K.toolResult:
      return applyToolResult(t, e)
    case K.fileEdit: {
      const { kind, ...rest } = e
      return upsert(t, { ...rest, kind, id: `${ID_PREFIX.edit}${e.toolCallId ?? seq}` })
    }
    case K.todo: {
      const { kind, ...rest } = e
      return upsert(t, { ...rest, kind, id: `${ID_PREFIX.todo}${e.toolCallId ?? seq}` })
    }
    case K.permissionRequest:
      return applyPermission(t, e)
    case K.permissionResolved:
      return applyPermissionResolved(t, e)
    case K.usage:
      return { ...t, usage: e }
    case K.error: {
      const { kind, fatal: _fatal, ...rest } = e
      return upsert(t, { ...rest, kind, id: `${ID_PREFIX.error}${seq}` })
    }
    case K.turnEnd:
      return applyTurnEnd(t, e, seq)
    case K.sessionExit: {
      const ended = { ...stopStreaming(t), turnActive: false, turnStartedAt: null }
      return upsert(ended, { kind: e.kind, id: `${ID_PREFIX.exit}${seq}`, reason: e.reason, exitCode: e.exitCode })
    }
    case K.queue:
      return { ...t, queue: e.queued }
    case K.custom:
      return applyCustom(t, e, seq)
    case K.responseResolved:
      return applyResponseResolved(t, e)
    default: {
      const never: never = e
      return never
    }
  }
}

/** Pure, idempotent reducer: an envelope with `seq <= lastSeq` returns `t` unchanged (RF3). */
export function reduceTranscript(t: ChatTranscript, env: ChatEventEnvelope): ChatTranscript {
  if (env.seq <= t.lastSeq) return t
  return { ...apply(t, env.event, env.seq, env.at), lastSeq: env.seq }
}

/** History replay: events get seq 1..n. */
export function reduceEvents(events: ChatEvent[], at = 0): ChatTranscript {
  return events.reduce(
    (t, event, i) => reduceTranscript(t, { sessionId: '', seq: i + 1, at, event }),
    emptyTranscript(),
  )
}
