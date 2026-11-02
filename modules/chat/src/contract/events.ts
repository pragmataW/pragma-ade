import { z } from '@pragma/sdk'
import {
  ATTACHMENT_KINDS,
  CHAT_ERROR_CODES,
  CHAT_PERMISSION_OPTIONS,
  CHAT_PERMISSION_OUTCOMES,
  CHAT_SESSION_ACTIONS,
  CHAT_TASK_KINDS,
  CHAT_TASK_STATUSES,
  CHAT_TOOL_KINDS,
  CUSTOM_EVENT_TYPE_RE,
  FILE_CHANGES,
  EVENT_KIND as K,
  KIND_KEY,
  MCP_SERVER_STATUSES,
  MESSAGE_ORIGINS,
  RATE_LIMIT_STATUSES,
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

/**
 * Nests the item under a subagent: the `toolCallId` of the tool call that spawned it, or a `task` event's `taskId`
 * (the kit renders it inside that task's card instead of the main transcript).
 */
const parent = { parentId: z.string().optional() }
const textPart = {
  messageId: z.string(),
  partId: z.string(),
  text: z.string(),
  mode: z.enum(TEXT_MODES),
  ...parent,
}
const count = z.number().int().nonnegative()

export const chatTaskUsageSchema = z.object({
  tokens: count,
  costUsd: z.number().optional(),
  toolUses: count.optional(),
  durationMs: count.optional(),
})
export type ChatTaskUsage = z.infer<typeof chatTaskUsageSchema>

export const chatQuestionOptionSchema = z.object({ label: z.string(), description: z.string().optional() })
export type ChatQuestionOption = z.infer<typeof chatQuestionOptionSchema>
export const chatQuestionSchema = z.object({
  question: z.string(),
  /** A short chip label (e.g. "Auth method"). */
  header: z.string().optional(),
  multiSelect: z.boolean(),
  options: z.array(chatQuestionOptionSchema),
  /** Default true: the card offers an "Other" free-text answer. */
  allowOther: z.boolean().optional(),
})
export type ChatQuestion = z.infer<typeof chatQuestionSchema>

/** `respond(eventId, …)` payload of a `question` (one answer per question, same order). */
export const chatQuestionResponseSchema = z.object({
  answers: z.array(z.object({ question: z.string(), selected: z.array(z.string()), other: z.string().optional() })),
})
export type ChatQuestionResponse = z.infer<typeof chatQuestionResponseSchema>

/** `respond(eventId, …)` payload of a `plan-proposal`; `mode` is a `permissionMode` value to continue in. */
export const chatPlanResponseSchema = z.object({
  approve: z.boolean(),
  mode: z.string().optional(),
  feedback: z.string().optional(),
})
export type ChatPlanResponse = z.infer<typeof chatPlanResponseSchema>

export const chatMcpServerSchema = z.object({
  name: z.string(),
  status: z.enum(MCP_SERVER_STATUSES),
  toolCount: count.optional(),
  error: z.string().optional(),
  /** e.g. `project`, `user` (shown as is). */
  scope: z.string().optional(),
})
export type ChatMcpServer = z.infer<typeof chatMcpServerSchema>

const rateLimitEventSchema = z.object({
  kind: z.literal(K.rateLimit),
  status: z.enum(RATE_LIMIT_STATUSES),
  /** Epoch ms. */
  resetsAt: z.number().optional(),
  /** Provider wording of the limit window (e.g. `five_hour`), shown as is. */
  window: z.string().optional(),
  /** 0..1 */
  utilization: z.number().min(0).max(1).optional(),
  message: z.string().optional(),
})
const retryEventSchema = z.object({
  kind: z.literal(K.retry),
  attempt: z.number().int().positive(),
  maxAttempts: z.number().int().positive().optional(),
  delayMs: count.optional(),
  reason: z.string().optional(),
})

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
export const chatEventSchema = z.discriminatedUnion(KIND_KEY, [
  z.object({
    kind: z.literal(K.sessionInfo),
    externalSessionId: z.string().optional(),
    commands: z.array(chatSlashCommandSchema).optional(),
    /** Core-filled: the optional actions the live handle implements (`chat.action`). */
    actions: z.array(z.enum(CHAT_SESSION_ACTIONS)).optional(),
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
    ...parent,
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
    ...parent,
  }),
  z.object({
    kind: z.literal(K.todo),
    toolCallId: z.string().optional(),
    items: z.array(todoItemSchema),
    ...parent,
  }),
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
    ...parent,
  }),
  z.object({ kind: z.literal(K.permissionResolved), requestId: z.string(), outcome: chatPermissionOutcomeSchema }),
  usageEventSchema,
  z.object({
    kind: z.literal(K.error),
    code: chatErrorCodeSchema,
    message: z.string(),
    detail: z.string().optional(),
    fatal: z.boolean(),
    ...parent,
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
  z.object({
    kind: z.literal(K.responseResolved),
    eventId: z.string(),
    outcome: z.enum(RESPONSE_OUTCOMES),
    /** One line describing the answer (shown on the resolved question / plan card). */
    summary: z.string().optional(),
  }),
  /**
   * A subagent, workflow run or background job; upserted by `taskId` (optional fields keep their last value). Its
   * output nests through `parentId` = `taskId` or `toolCallId`; `parentId` here nests it under a parent task.
   */
  z.object({
    kind: z.literal(K.task),
    taskId: z.string(),
    toolCallId: z.string().optional(),
    taskKind: z.enum(CHAT_TASK_KINDS),
    /** Subagent type or workflow name. */
    name: z.string(),
    description: z.string().optional(),
    status: z.enum(CHAT_TASK_STATUSES),
    summary: z.string().optional(),
    lastTool: z.string().optional(),
    usage: chatTaskUsageSchema.optional(),
    depth: count.optional(),
    ...parent,
  }),
  /** Multiple-choice questions to the user; answered by `respond(eventId, ChatQuestionResponse)`. */
  z.object({
    kind: z.literal(K.question),
    eventId: z.string(),
    questions: z.array(chatQuestionSchema).min(1),
    ...parent,
  }),
  /** A plan (Markdown) awaiting approval; answered by `respond(eventId, ChatPlanResponse)`. */
  z.object({
    kind: z.literal(K.planProposal),
    eventId: z.string(),
    plan: z.string(),
    /** `permissionMode` values offered on approve; default: every mode but the current one. */
    modes: z.array(z.string()).optional(),
    ...parent,
  }),
  /** Full replacement of the session's MCP server list. */
  z.object({ kind: z.literal(K.mcpStatus), servers: z.array(chatMcpServerSchema) }),
  rateLimitEventSchema,
  /** The provider retries a failed API request; cleared by the next output or turn end. */
  retryEventSchema,
])
export type ChatEvent = z.infer<typeof chatEventSchema>
export type ChatEventKind = ChatEvent['kind']
export type ChatEventOf<K extends ChatEventKind> = Extract<ChatEvent, { kind: K }>
export type UsageEvent = z.infer<typeof usageEventSchema>
export type RateLimitEvent = z.infer<typeof rateLimitEventSchema>
export type RetryEvent = z.infer<typeof retryEventSchema>

export const chatEventEnvelopeSchema = z.object({
  sessionId: z.string(),
  seq: z.number().int().positive(),
  at: z.number(),
  event: chatEventSchema,
})
export type ChatEventEnvelope = z.infer<typeof chatEventEnvelopeSchema>
