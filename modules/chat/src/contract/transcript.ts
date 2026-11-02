import type { ChatSessionActionKind } from './actions'
import { EVENT_KIND as K, RATE_LIMIT_STATUS, TEXT_MODE, TOOL_KIND, TOOL_STATUSES, TURN_END_REASON } from './constants'
import type {
  ChatAttachmentRef,
  ChatErrorCode,
  ChatEvent,
  ChatEventEnvelope,
  ChatEventOf,
  ChatMcpServer,
  ChatPermissionOutcome,
  ChatSlashCommand,
  ChatToolKind,
  QueuedMessage,
  RateLimitEvent,
  RetryEvent,
  UsageEvent,
} from './events'
import type { ChatOptionDescriptor } from './options'

type Body<E> = Omit<E, 'kind'>
type ToolStatus = (typeof TOOL_STATUSES)[number]
type ResponseOutcome = ChatEventOf<typeof K.responseResolved>['outcome']

export interface MessageItem {
  kind: typeof K.message
  id: string
  role: ChatEventOf<typeof K.message>['role']
  text: string
  attachments: ChatAttachmentRef[]
  /** When the message was sent (envelope time). */
  at: number
  /** Sent while the agent worked and not yet taken in (`message-ack` clears it). */
  midTurn?: boolean
}
export interface TextItem<Kind extends typeof K.textDelta | typeof K.thinking = typeof K.textDelta> {
  kind: Kind
  /** The part id. */
  id: string
  messageId: string
  text: string
  streaming: boolean
  parentId?: string
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
  parentId?: string
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
  parentId?: string
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
/** The answer state shared by interactive items (`response-resolved`). */
interface Resolvable {
  resolved?: ResponseOutcome
  summary?: string
}
export interface CustomItem extends Resolvable {
  kind: typeof K.custom
  id: string
  type: string
  data: unknown
  eventId?: string
  awaitsResponse: boolean
}
/** A subagent / workflow / background task (the task id); its output is `childItems(t, [id, toolCallId])`. */
export type TaskItem = Omit<Body<ChatEventOf<typeof K.task>>, 'taskId'> & { kind: typeof K.task; id: string }
/** The event id (`respond(id, ChatQuestionResponse)`). */
export type QuestionItem = Omit<Body<ChatEventOf<typeof K.question>>, 'eventId'> &
  Resolvable & { kind: typeof K.question; id: string }
/** The event id (`respond(id, ChatPlanResponse)`). */
export type PlanItem = Omit<Body<ChatEventOf<typeof K.planProposal>>, 'eventId'> &
  Resolvable & { kind: typeof K.planProposal; id: string }

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
  | TaskItem
  | QuestionItem
  | PlanItem
export type ChatItemKind = ChatItem['kind']
type InteractiveItem = CustomItem | QuestionItem | PlanItem

export interface ChatTranscript {
  items: ChatItem[]
  /** `itemKey(kind, id)` → index in `items`. */
  positions: Record<string, number>
  /** `parentId` → the `itemKey`s nested under it, in arrival order (subagent output). */
  children: Record<string, string[]>
  info: {
    externalSessionId?: string
    commands: ChatSlashCommand[]
    options: ChatOptionDescriptor[]
    /** Optional actions of the live handle; empty when the process is gone. */
    actions: ChatSessionActionKind[]
  }
  usage: UsageEvent | null
  mcpServers: ChatMcpServer[]
  /** The latest rate-limit notice (null once `cleared`). */
  rateLimit: Body<RateLimitEvent> | null
  /** The retry in progress (null after the next output or turn end). */
  retry: Body<RetryEvent> | null
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
    children: {},
    info: { commands: [], options: [], actions: [] },
    usage: null,
    mcpServers: [],
    rateLimit: null,
    retry: null,
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

/** The `parentId` of an item that has one (subagent output). */
export const parentOf = (item: ChatItem): string | undefined => ('parentId' in item ? item.parentId : undefined)

function withChild(children: ChatTranscript['children'], parentId: string | undefined, key: string) {
  if (!parentId) return children
  return { ...children, [parentId]: [...(children[parentId] ?? []), key] }
}

/** Replaces the item with the same kind and id, or appends it (indexed under its `parentId`). */
function upsert(t: ChatTranscript, item: ChatItem): ChatTranscript {
  const key = itemKey(item.kind, item.id)
  const pos = t.positions[key]
  if (pos !== undefined) {
    const items = t.items.slice()
    items[pos] = item
    return { ...t, items }
  }
  return {
    ...t,
    items: [...t.items, item],
    positions: { ...t.positions, [key]: t.items.length },
    children: withChild(t.children, parentOf(item), key),
  }
}

/** The fields of `o` that are set (an update event keeps the earlier values of the ones it omits). */
const defined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

const isStreamingText = (i: ChatItem): i is TextItem | ThinkingItem =>
  (i.kind === K.textDelta || i.kind === K.thinking) && i.streaming

/** Ends every streaming text part (turn end, exit); copies `items` only when something changed. */
function stopStreaming(t: ChatTranscript): ChatTranscript {
  if (!t.items.some(isStreamingText)) return t
  return { ...t, items: t.items.map((i) => (isStreamingText(i) ? { ...i, streaming: false } : i)) }
}

const clearRetry = (t: ChatTranscript): ChatTranscript => (t.retry ? { ...t, retry: null } : t)

function applyText(t: ChatTranscript, e: ChatEventOf<typeof K.textDelta> | ChatEventOf<typeof K.thinking>) {
  const prev = find<TextItem | ThinkingItem>(t, e.kind, e.partId)
  const snapshot = e.mode === TEXT_MODE.snapshot
  const text = snapshot || !prev ? e.text : prev.text + e.text
  const parentId = e.parentId ?? prev?.parentId
  const item = { kind: e.kind, id: e.partId, messageId: e.messageId, text, streaming: !snapshot }
  return upsert(clearRetry(t), (parentId ? { ...item, parentId } : item) as ChatItem)
}

const TOOL_RANK: Record<ToolStatus, number> = Object.fromEntries(TOOL_STATUSES.map((s, i) => [s, i])) as Record<
  ToolStatus,
  number
>

function applyToolCall(t: ChatTranscript, e: ChatEventOf<typeof K.toolCall>): ChatTranscript {
  const prev = find<ToolCallItem>(t, K.toolCall, e.toolCallId)
  const status = prev && TOOL_RANK[prev.status] > TOOL_RANK[e.status] ? prev.status : e.status
  const parentId = e.parentId ?? prev?.parentId
  return upsert(clearRetry(t), {
    ...prev,
    kind: K.toolCall,
    id: e.toolCallId,
    name: e.name,
    toolKind: e.toolKind,
    title: e.title ?? prev?.title,
    input: e.input,
    status,
    ...(parentId ? { parentId } : {}),
  })
}

function applyToolResult(t: ChatTranscript, e: ChatEventOf<typeof K.toolResult>): ChatTranscript {
  const prev = find<ToolCallItem>(t, K.toolCall, e.toolCallId)
  const { kind: _kind, toolCallId, ...result } = e
  const base = prev ?? { kind: K.toolCall, id: toolCallId, name: '', toolKind: TOOL_KIND.other, input: undefined }
  return upsert(t, { ...base, ...result } as ToolCallItem)
}

const opened = (t: ChatTranscript): ChatTranscript => ({ ...t, pendingInteractions: t.pendingInteractions + 1 })
const closed = (t: ChatTranscript): ChatTranscript => ({
  ...t,
  pendingInteractions: Math.max(0, t.pendingInteractions - 1),
})

function applyPermission(t: ChatTranscript, e: ChatEventOf<typeof K.permissionRequest>): ChatTranscript {
  const { kind: _kind, requestId, ...rest } = e
  const isNew = !find(t, K.permissionRequest, requestId)
  const next = upsert(t, { ...rest, kind: K.permissionRequest, id: requestId })
  return isNew ? opened(next) : next
}

function applyPermissionResolved(t: ChatTranscript, e: ChatEventOf<typeof K.permissionResolved>): ChatTranscript {
  const prev = find<PermissionItem>(t, K.permissionRequest, e.requestId)
  if (!prev || prev.outcome) return t
  return closed(upsert(t, { ...prev, outcome: e.outcome }))
}

function applyCustom(t: ChatTranscript, e: ChatEventOf<typeof K.custom>, seq: number): ChatTranscript {
  const id = e.eventId ?? `${ID_PREFIX.custom}${seq}`
  const awaitsResponse = e.awaitsResponse === true
  const isNew = !find(t, K.custom, id)
  const item: CustomItem = { kind: K.custom, id, type: e.type, data: e.data, awaitsResponse }
  if (e.eventId) item.eventId = e.eventId
  const next = upsert(t, item)
  return awaitsResponse && isNew ? opened(next) : next
}

/** A question or plan proposal: always awaits a response (re-sent events update the card, not the count). */
function applyPrompt(
  t: ChatTranscript,
  e: ChatEventOf<typeof K.question> | ChatEventOf<typeof K.planProposal>,
): ChatTranscript {
  const { eventId, ...rest } = e
  const prev = find<QuestionItem | PlanItem>(t, e.kind, eventId)
  const next = upsert(t, { ...prev, ...rest, id: eventId } as QuestionItem | PlanItem)
  return prev ? next : opened(next)
}

const INTERACTIVE_KINDS = [K.custom, K.question, K.planProposal] as const
const awaits = (i: InteractiveItem): boolean => (i.kind === K.custom ? i.awaitsResponse : true)

function applyResponseResolved(t: ChatTranscript, e: ChatEventOf<typeof K.responseResolved>): ChatTranscript {
  const prev = INTERACTIVE_KINDS.map((k) => find<InteractiveItem>(t, k, e.eventId)).find(Boolean)
  if (!prev || prev.resolved) return t
  const next = upsert(t, { ...prev, resolved: e.outcome, ...(e.summary ? { summary: e.summary } : {}) })
  return awaits(prev) ? closed(next) : next
}

/** The message no longer waits to be taken in. */
function applyMessageAck(t: ChatTranscript, messageId: string): ChatTranscript {
  const prev = find<MessageItem>(t, K.message, messageId)
  if (!prev?.midTurn) return t
  const { midTurn: _done, ...rest } = prev
  return upsert(t, rest)
}

function applyTask(t: ChatTranscript, e: ChatEventOf<typeof K.task>): ChatTranscript {
  const { kind, taskId, ...rest } = e
  const prev = find<TaskItem>(t, K.task, taskId)
  return upsert(t, { ...prev, ...defined(rest), kind, id: taskId } as TaskItem)
}

function applyRateLimit(t: ChatTranscript, e: RateLimitEvent): ChatTranscript {
  const { kind: _kind, ...rest } = e
  return { ...t, rateLimit: e.status === RATE_LIMIT_STATUS.cleared ? null : rest }
}

function applyTurnEnd(t: ChatTranscript, e: ChatEventOf<typeof K.turnEnd>, seq: number): ChatTranscript {
  const ended = { ...stopStreaming(t), turnActive: false, turnStartedAt: null, retry: null }
  if (e.reason === TURN_END_REASON.completed) return ended
  return upsert(ended, { kind: K.turnEnd, id: `${ID_PREFIX.end}${seq}`, reason: e.reason })
}

function applySessionExit(t: ChatTranscript, e: ChatEventOf<typeof K.sessionExit>, seq: number): ChatTranscript {
  const ended = {
    ...stopStreaming(t),
    turnActive: false,
    turnStartedAt: null,
    retry: null,
    info: { ...t.info, actions: [] },
  }
  return upsert(ended, { kind: e.kind, id: `${ID_PREFIX.exit}${seq}`, reason: e.reason, exitCode: e.exitCode })
}

function applySessionInfo(t: ChatTranscript, e: ChatEventOf<typeof K.sessionInfo>): ChatTranscript {
  const info = { ...t.info, commands: e.commands ?? t.info.commands, actions: e.actions ?? t.info.actions }
  const externalSessionId = e.externalSessionId ?? t.info.externalSessionId
  return { ...t, info: externalSessionId ? { ...info, externalSessionId } : info }
}

/** Items keyed by an id of their own (`file-edit`, `todo`, `error`). */
function applyKeyed(
  t: ChatTranscript,
  e: ChatEventOf<typeof K.fileEdit> | ChatEventOf<typeof K.todo> | ChatEventOf<typeof K.error>,
  seq: number,
): ChatTranscript {
  if (e.kind === K.error) {
    const { fatal: _fatal, ...rest } = e
    return upsert(t, { ...rest, id: `${ID_PREFIX.error}${seq}` })
  }
  const prefix = e.kind === K.fileEdit ? ID_PREFIX.edit : ID_PREFIX.todo
  return upsert(t, { ...e, id: `${prefix}${e.toolCallId ?? seq}` } as FileEditItem | TodoListItem)
}

function apply(t: ChatTranscript, e: ChatEvent, seq: number, at: number): ChatTranscript {
  switch (e.kind) {
    case K.sessionInfo:
      return applySessionInfo(t, e)
    case K.options:
      return { ...t, info: { ...t.info, options: e.options } }
    case K.message:
      return upsert(t, {
        kind: K.message,
        id: e.messageId,
        role: e.role,
        text: e.text,
        attachments: e.attachments,
        at,
        ...(e.midTurn ? { midTurn: true } : {}),
      })
    case K.messageAck:
      return applyMessageAck(t, e.messageId)
    case K.turnStart:
      return { ...t, turnActive: true, turnStartedAt: at }
    case K.textDelta:
    case K.thinking:
      return applyText(t, e)
    case K.toolCall:
      return applyToolCall(t, e)
    case K.toolResult:
      return applyToolResult(t, e)
    case K.fileEdit:
    case K.todo:
    case K.error:
      return applyKeyed(t, e, seq)
    case K.permissionRequest:
      return applyPermission(t, e)
    case K.permissionResolved:
      return applyPermissionResolved(t, e)
    case K.usage:
      return { ...t, usage: e }
    case K.turnEnd:
      return applyTurnEnd(t, e, seq)
    case K.sessionExit:
      return applySessionExit(t, e, seq)
    case K.queue:
      return { ...t, queue: e.queued }
    case K.custom:
      return applyCustom(t, e, seq)
    case K.responseResolved:
      return applyResponseResolved(t, e)
    case K.task:
      return applyTask(t, e)
    case K.question:
    case K.planProposal:
      return applyPrompt(t, e)
    case K.mcpStatus:
      return { ...t, mcpServers: e.servers }
    case K.rateLimit:
      return applyRateLimit(t, e)
    case K.retry: {
      const { kind: _kind, ...retry } = e
      return { ...t, retry }
    }
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

/** The items nested under any of `parentIds` (e.g. a task's id and its tool call id), in transcript order. */
export function childItems(t: ChatTranscript, parentIds: readonly (string | undefined)[]): ChatItem[] {
  const keys = new Set(parentIds.flatMap((p) => (p ? (t.children[p] ?? []) : [])))
  return [...keys]
    .map((k) => t.positions[k])
    .filter((p): p is number => p !== undefined)
    .sort((a, b) => a - b)
    .flatMap((p) => t.items[p] ?? [])
}

/** The task a tool call spawned, if the provider reported one. */
export const taskOfToolCall = (t: ChatTranscript, toolCallId: string): TaskItem | undefined =>
  t.items.find((i): i is TaskItem => i.kind === K.task && i.toolCallId === toolCallId)
