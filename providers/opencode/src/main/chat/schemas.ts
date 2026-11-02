/** zod schemas for the parts of OpenCode's 2.x API this adapter consumes (loose: OpenCode may add fields). */
import { z } from '@pragma/sdk'
import { formFieldSchema } from '../../renderer/chat/payloads'
import {
  CONTENT_TYPES,
  EV,
  FILE_STATUSES,
  IDLE_OUTCOMES,
  MESSAGE_TYPES,
  OPENCODE_TODO_STATUSES,
  OTHER_EVENT,
  PERMISSION_DECISIONS,
  TYPE_KEY,
} from './constants'

/** An array whose invalid items are dropped instead of failing the whole parse. */
const lenientArray = <T extends z.ZodType>(item: T) =>
  z.array(z.unknown()).transform((xs) =>
    xs.flatMap((x) => {
      const r = item.safeParse(x)
      return r.success ? [r.data as z.infer<T>] : []
    }),
  )

export const structuredErrorSchema = z.looseObject({
  type: z.string(),
  message: z.string(),
  status: z.number().optional(),
})
export type StructuredError = z.infer<typeof structuredErrorSchema>

export const tokensSchema = z.looseObject({
  input: z.number(),
  output: z.number(),
  reasoning: z.number().default(0),
  cache: z.looseObject({ read: z.number(), write: z.number() }),
})
export type Tokens = z.infer<typeof tokensSchema>

export const modelRefSchema = z.looseObject({ id: z.string(), providerID: z.string(), variant: z.string().optional() })
export type ModelRef = z.infer<typeof modelRefSchema>

export const toolContentSchema = z.discriminatedUnion(TYPE_KEY, [
  z.looseObject({ type: z.literal(CONTENT_TYPES.text), text: z.string() }),
  z.looseObject({
    type: z.literal(CONTENT_TYPES.file),
    uri: z.string(),
    mime: z.string(),
    name: z.string().optional(),
  }),
])
export type ToolContent = z.infer<typeof toolContentSchema>

export const fileDiffSchema = z.looseObject({
  file: z.string(),
  patch: z.string(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  status: z.enum(FILE_STATUSES),
})
export type FileDiff = z.infer<typeof fileDiffSchema>

export const todoSchema = z.looseObject({
  content: z.string(),
  status: z.enum(OPENCODE_TODO_STATUSES),
  priority: z.string().optional(),
})
export type OpencodeTodo = z.infer<typeof todoSchema>

export const toolMetadataSchema = z.looseObject({
  files: lenientArray(fileDiffSchema).optional(),
  todos: lenientArray(todoSchema).optional(),
  /** The child session a `subagent` tool runs (progress + result). */
  sessionID: z.string().optional(),
})
export type ToolMetadata = z.infer<typeof toolMetadataSchema>

export const formSchema = z.looseObject({
  id: z.string(),
  sessionID: z.string(),
  title: z.string(),
  fields: z.array(formFieldSchema),
})
export type OpencodeForm = z.infer<typeof formSchema>

const toolInput = z.record(z.string(), z.unknown())
const sid = { sessionID: z.string() }
const msg = { ...sid, assistantMessageID: z.string() }
const text = { ...msg, ordinal: z.number() }

/** Event `data` per consumed type. */
const EVENT_DATA = {
  [EV.connected]: z.looseObject({}),
  [EV.inboxEnqueued]: z.looseObject(sid),
  [EV.executionStarted]: z.looseObject(sid),
  [EV.executionSucceeded]: z.looseObject(sid),
  [EV.executionFailed]: z.looseObject({ ...sid, error: structuredErrorSchema }),
  [EV.executionInterrupted]: z.looseObject({ ...sid, reason: z.string().optional() }),
  [EV.stepStarted]: z.looseObject({ ...msg, model: modelRefSchema }),
  [EV.stepEnded]: z.looseObject({ ...msg, tokens: tokensSchema, cost: z.number() }),
  [EV.stepFailed]: z.looseObject({ ...sid, error: structuredErrorSchema }),
  [EV.retryScheduled]: z.looseObject({ ...sid, attempt: z.number(), at: z.number(), error: structuredErrorSchema }),
  [EV.usageUpdated]: z.looseObject({ ...sid, tokens: tokensSchema, cost: z.number() }),
  [EV.textDelta]: z.looseObject({ ...text, delta: z.string() }),
  [EV.textEnded]: z.looseObject({ ...text, text: z.string() }),
  [EV.reasoningDelta]: z.looseObject({ ...text, delta: z.string() }),
  [EV.reasoningEnded]: z.looseObject({ ...text, text: z.string() }),
  [EV.toolInputStarted]: z.looseObject({ ...sid, id: z.string(), name: z.string() }),
  [EV.toolCalled]: z.looseObject({ ...sid, id: z.string(), input: toolInput }),
  [EV.toolSuccess]: z.looseObject({
    ...sid,
    id: z.string(),
    content: lenientArray(toolContentSchema),
    metadata: toolMetadataSchema.optional(),
  }),
  [EV.toolFailed]: z.looseObject({
    ...sid,
    id: z.string(),
    error: structuredErrorSchema,
    metadata: toolMetadataSchema.optional(),
  }),
  [EV.permissionAsked]: z.looseObject({
    ...sid,
    id: z.string(),
    action: z.string(),
    resources: z.array(z.string()),
    save: z.array(z.string()).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
    source: z.looseObject({ type: z.string(), messageID: z.string().optional(), id: z.string() }).optional(),
    message: z.string().optional(),
  }),
  [EV.permissionReplied]: z.looseObject({ ...sid, requestID: z.string(), reply: z.enum(PERMISSION_DECISIONS) }),
  [EV.formCreated]: z.looseObject({ form: formSchema }),
  [EV.formReplied]: z.looseObject({ ...sid, id: z.string(), answer: z.unknown() }),
  [EV.formCancelled]: z.looseObject({ ...sid, id: z.string() }),
  [EV.sessionCreated]: z.looseObject({
    ...sid,
    parentID: z.string().optional(),
    agent: z.string().optional(),
    title: z.string().optional(),
  }),
  [EV.toolProgress]: z.looseObject({ ...sid, id: z.string(), metadata: toolMetadataSchema }),
  [EV.mcpStatusChanged]: z.looseObject({ server: z.string() }),
  [EV.modelUpdated]: z.looseObject({}),
  [EV.providerUpdated]: z.looseObject({}),
  [EV.integrationUpdated]: z.looseObject({}),
  [EV.credentialUpdated]: z.looseObject({}),
} as const satisfies Record<(typeof EV)[keyof typeof EV], z.ZodType>

type EventDataMap = typeof EVENT_DATA
export type V2EventType = keyof EventDataMap
type KnownEvent<T extends V2EventType> = { id: string; type: T; data: z.infer<EventDataMap[T]> }
export type V2Event = { [T in V2EventType]: KnownEvent<T> }[V2EventType] | { type: typeof OTHER_EVENT }
export type V2EventOf<T extends V2EventType> = KnownEvent<T>

export const v2EnvelopeSchema = z.looseObject({ id: z.string(), type: z.string(), data: z.unknown() })

const isKnownType = (t: string): t is V2EventType => Object.hasOwn(EVENT_DATA, t)

/** A v2 SSE event: invalid data for a consumed type → null; an unknown type → `{type:'other'}`. */
export function parseV2Event(raw: unknown): V2Event | null {
  const env = v2EnvelopeSchema.safeParse(raw)
  if (!env.success) return null
  const { id, type } = env.data
  if (!isKnownType(type)) return { type: OTHER_EVENT }
  const data = EVENT_DATA[type].safeParse(env.data.data)
  return data.success ? ({ id, type, data: data.data } as V2Event) : null
}

// ── messages (history) ─────────────────────────────────────────────────────

const toolStateSchema = z.looseObject({
  status: z.string(),
  input: toolInput.optional(),
  content: lenientArray(toolContentSchema).optional(),
  metadata: toolMetadataSchema.optional(),
  error: structuredErrorSchema.optional(),
})
export type ToolState = z.infer<typeof toolStateSchema>

export const assistantContentSchema = z.discriminatedUnion(TYPE_KEY, [
  z.looseObject({ type: z.literal(CONTENT_TYPES.text), text: z.string() }),
  z.looseObject({ type: z.literal(CONTENT_TYPES.reasoning), text: z.string() }),
  z.looseObject({ type: z.literal(CONTENT_TYPES.tool), id: z.string(), name: z.string(), state: toolStateSchema }),
])
export type AssistantContent = z.infer<typeof assistantContentSchema>

const userMessageSchema = z.looseObject({
  id: z.string(),
  type: z.literal(MESSAGE_TYPES.user),
  text: z.string(),
  files: lenientArray(z.looseObject({ mime: z.string(), name: z.string().optional() })).optional(),
})
const assistantMessageSchema = z.looseObject({
  id: z.string(),
  type: z.literal(MESSAGE_TYPES.assistant),
  model: modelRefSchema.optional(),
  content: lenientArray(assistantContentSchema),
  tokens: tokensSchema.optional(),
  cost: z.number().optional(),
  error: structuredErrorSchema.optional(),
})
const idleMessageSchema = z.looseObject({
  id: z.string(),
  type: z.literal(MESSAGE_TYPES.idle),
  outcome: z.enum(IDLE_OUTCOMES),
})

export const messageSchema = z.discriminatedUnion(TYPE_KEY, [
  userMessageSchema,
  assistantMessageSchema,
  idleMessageSchema,
])
export type Message = z.infer<typeof messageSchema>
export type IdleOutcome = (typeof IDLE_OUTCOMES)[number]

export const messagePageSchema = z.looseObject({
  data: lenientArray(messageSchema),
  cursor: z.looseObject({ next: z.string().nullish() }).optional(),
})

// ── catalog ────────────────────────────────────────────────────────────────

export const modelInfoSchema = z.looseObject({
  id: z.string(),
  providerID: z.string(),
  name: z.string(),
  variants: z.array(z.looseObject({ id: z.string() })).default([]),
  limit: z.looseObject({ context: z.number() }).optional(),
  enabled: z.boolean().optional(),
})
export type ModelInfo = z.infer<typeof modelInfoSchema>

export const agentInfoSchema = z.looseObject({
  id: z.string(),
  name: z.string(),
  mode: z.string(),
  hidden: z.boolean().default(false),
  description: z.string().optional(),
})
export type AgentInfo = z.infer<typeof agentInfoSchema>

export const commandSchema = z.looseObject({ name: z.string(), description: z.string().optional() })
export type OpencodeCommand = z.infer<typeof commandSchema>

/** `{ data: T }` list envelopes (`/api/model`, `/api/agent`, `/api/command`). */
export const listOf = <T extends z.ZodType>(item: T) => z.looseObject({ data: lenientArray(item) })
export const defaultModelSchema = z.looseObject({ data: modelInfoSchema.nullable() })

export const serverInfoSchema = z.looseObject({ version: z.string() })
export const healthSchema = z.looseObject({ version: z.string() })
export const sessionInfoSchema = z.looseObject({
  id: z.string(),
  agent: z.string().optional(),
  model: modelRefSchema.optional(),
})
export type SessionInfo = z.infer<typeof sessionInfoSchema>
