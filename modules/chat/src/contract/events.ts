import { z } from '@pragma/sdk'
import {
  ATTACHMENT_KINDS,
  CHAT_ERROR_CODES,
  CHAT_PERMISSION_OPTIONS,
  CHAT_PERMISSION_OUTCOMES,
  CHAT_TOOL_KINDS,
  CUSTOM_EVENT_TYPE_RE,
  FILE_CHANGES,
  EVENT_KIND as K,
  MESSAGE_ORIGINS,
  RESPONSE_OUTCOMES,
  SESSION_EXIT_REASONS,
  TEXT_MODES,
  TODO_STATUSES,
  TOOL_CALL_STATUSES,
  TOOL_RESULT_STATUSES,
  TURN_END_REASONS,
  USER_ROLE,
} from './constants'
import { chatOptionDescriptorSchema } from './options'

export const chatToolKindSchema = z.enum(CHAT_TOOL_KINDS)
export type ChatToolKind = z.infer<typeof chatToolKindSchema>
export const chatPermissionOptionSchema = z.enum(CHAT_PERMISSION_OPTIONS)
export type ChatPermissionOptionId = z.infer<typeof chatPermissionOptionSchema>
export const chatPermissionOutcomeSchema = z.enum(CHAT_PERMISSION_OUTCOMES)
export type ChatPermissionOutcome = z.infer<typeof chatPermissionOutcomeSchema>
export const chatErrorCodeSchema = z.enum(CHAT_ERROR_CODES)
export type ChatErrorCode = z.infer<typeof chatErrorCodeSchema>

export const chatSlashCommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  argumentHint: z.string().optional(),
})
export type ChatSlashCommand = z.infer<typeof chatSlashCommandSchema>

export const chatAttachmentRefSchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS),
  name: z.string(),
  mediaType: z.string(),
})
export type ChatAttachmentRef = z.infer<typeof chatAttachmentRefSchema>

export const fileEditHunkSchema = z.object({ before: z.string(), after: z.string() })
export type FileEditHunk = z.infer<typeof fileEditHunkSchema>
export const todoItemSchema = z.object({ id: z.string(), text: z.string(), status: z.enum(TODO_STATUSES) })
export type TodoItem = z.infer<typeof todoItemSchema>
export const queuedMessageSchema = z.object({ id: z.string(), text: z.string() })
export type QueuedMessage = z.infer<typeof queuedMessageSchema>

/** `<provider-id>.<name>` */
export type CustomEventType = `${string}.${string}`
const customTypeSchema = z.custom<CustomEventType>((v) => typeof v === 'string' && CUSTOM_EVENT_TYPE_RE.test(v))

const textPart = { messageId: z.string(), partId: z.string(), text: z.string(), mode: z.enum(TEXT_MODES) }
const count = z.number().int().nonnegative()

const usageEventSchema = z.object({
  kind: z.literal(K.usage),
  inputTokens: count,
  outputTokens: count,
  cacheReadTokens: count,
  cacheWriteTokens: count,
  /** Cumulative for the session. */
  costUsd: z.number().optional(),
  contextTokens: count.optional(),
  contextWindow: count.optional(),
})

/** The extensible, provider-neutral chat event model (§5.4); `custom` carries provider-specific events. */
export const chatEventSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal(K.sessionInfo),
    externalSessionId: z.string().optional(),
    commands: z.array(chatSlashCommandSchema).optional(),
  }),
  /** Full replacement of the session's option list. */
  z.object({ kind: z.literal(K.options), options: z.array(chatOptionDescriptorSchema) }),
  z.object({
    kind: z.literal(K.message),
    messageId: z.string(),
    role: z.literal(USER_ROLE),
    text: z.string(),
    attachments: z.array(chatAttachmentRefSchema),
    origin: z.enum(MESSAGE_ORIGINS),
  }),
  z.object({ kind: z.literal(K.turnStart), turnId: z.string() }),
  z.object({ kind: z.literal(K.textDelta), ...textPart }),
  z.object({ kind: z.literal(K.thinking), ...textPart }),
  z.object({
    kind: z.literal(K.toolCall),
    toolCallId: z.string(),
    name: z.string(),
    toolKind: chatToolKindSchema,
    title: z.string().optional(),
    input: z.unknown(),
    status: z.enum(TOOL_CALL_STATUSES),
  }),
  z.object({
    kind: z.literal(K.toolResult),
    toolCallId: z.string(),
    status: z.enum(TOOL_RESULT_STATUSES),
    output: z.string().optional(),
    outputTruncated: z.boolean().optional(),
    error: z.string().optional(),
  }),
  z.object({
    kind: z.literal(K.fileEdit),
    toolCallId: z.string().optional(),
    path: z.string(),
    change: z.enum(FILE_CHANGES),
    hunks: z.array(fileEditHunkSchema),
  }),
  z.object({ kind: z.literal(K.todo), toolCallId: z.string().optional(), items: z.array(todoItemSchema) }),
  z.object({
    kind: z.literal(K.permissionRequest),
    requestId: z.string(),
    toolCallId: z.string().optional(),
    toolName: z.string(),
    toolKind: chatToolKindSchema,
    title: z.string(),
    detail: z.string().optional(),
    input: z.unknown(),
    options: z.array(chatPermissionOptionSchema),
  }),
  z.object({ kind: z.literal(K.permissionResolved), requestId: z.string(), outcome: chatPermissionOutcomeSchema }),
  usageEventSchema,
  z.object({
    kind: z.literal(K.error),
    code: chatErrorCodeSchema,
    message: z.string(),
    detail: z.string().optional(),
    fatal: z.boolean(),
  }),
  z.object({ kind: z.literal(K.turnEnd), turnId: z.string().optional(), reason: z.enum(TURN_END_REASONS) }),
  z.object({
    kind: z.literal(K.sessionExit),
    exitCode: z.number().int().nullable(),
    reason: z.enum(SESSION_EXIT_REASONS),
  }),
  /** Core-emitted only. */
  z.object({ kind: z.literal(K.queue), queued: z.array(queuedMessageSchema) }),
  z.object({
    kind: z.literal(K.custom),
    type: customTypeSchema,
    data: z.unknown(),
    /** Set for interactive events answered through `ChatSessionHandle.respond`. */
    eventId: z.string().optional(),
    awaitsResponse: z.boolean().optional(),
  }),
  z.object({ kind: z.literal(K.responseResolved), eventId: z.string(), outcome: z.enum(RESPONSE_OUTCOMES) }),
])
export type ChatEvent = z.infer<typeof chatEventSchema>
export type ChatEventKind = ChatEvent['kind']
export type ChatEventOf<K extends ChatEventKind> = Extract<ChatEvent, { kind: K }>
export type UsageEvent = z.infer<typeof usageEventSchema>

export const chatEventEnvelopeSchema = z.object({
  sessionId: z.string(),
  seq: z.number().int().positive(),
  at: z.number(),
  event: chatEventSchema,
})
export type ChatEventEnvelope = z.infer<typeof chatEventEnvelopeSchema>
