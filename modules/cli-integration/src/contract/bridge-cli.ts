import { z } from '@pragma/sdk'
import { MAX_DOCUMENT_BYTES } from './constants'
import { sessionTranscriptLocationSchema } from './session-transcript-capability'

/** Bridge namespace served by this module; wire types are `cli.<method>`. */
export const CLI_NAMESPACE = 'cli'
export const CLI_METHODS = [
  'worktreeList',
  'worktreeCreate',
  'agentList',
  'agentSpawn',
  'profileList',
  'taskList',
  'taskCreate',
  'taskUpdate',
  'taskMove',
  'commentsList',
  'handoff',
  'sessionLocate',
] as const
export type CliMethod = (typeof CLI_METHODS)[number]
/** `CLI_METHOD.handoff === 'handoff'`: named access to the methods (one source). */
export const CLI_METHOD = Object.fromEntries(CLI_METHODS.map((m) => [m, m])) as { readonly [K in CliMethod]: K }
/** Liveness probe the CLI sends (short timeout) before the real request; not a user command. */
export const CLI_PING_METHOD = 'ping'

/** The CLI's wire vocabulary for priorities (equal to the board's `PRIORITIES`, pinned by a test). */
export const CLI_PRIORITIES = ['none', 'low', 'medium', 'high', 'urgent'] as const
export type CliPriority = (typeof CLI_PRIORITIES)[number]
export const CLI_ERROR_CODES = [
  'invalid_argument',
  'not_found',
  'ambiguous',
  'module_unavailable',
  'conflict',
  'internal',
  'timeout',
] as const
export type CliErrorCode = (typeof CLI_ERROR_CODES)[number]
/** `{ not_found: 'not_found', … }` so code names error codes instead of repeating literals. */
export const CLI_ERROR = Object.fromEntries(CLI_ERROR_CODES.map((c) => [c, c])) as {
  readonly [K in CliErrorCode]: K
}
/** Codes only the CLI produces (never sent by the app). */
export const CLI_LOCAL_ERROR = { usage: 'usage', notRunning: 'not_running' } as const

const id = z.string().min(1)
const text = z.string().trim().min(1)
const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length
const DOCUMENT_TOO_LARGE = `must be at most ${MAX_DOCUMENT_BYTES} bytes`
/** Non-empty text of at most `MAX_DOCUMENT_BYTES` UTF-8 bytes. */
const documentText = z
  .string()
  .min(1)
  .refine((s) => utf8Bytes(s) <= MAX_DOCUMENT_BYTES, { message: DOCUMENT_TOO_LARGE })
/** What the user typed for a task (`42` or a board key such as `PRA-12`); main resolves it. */
export const taskRefSchema = text
const labels = z.array(text)
const priority = z.enum(CLI_PRIORITIES)

export const cliCallerContextSchema = z.object({
  worktreeId: id.optional(),
  sessionId: id.optional(),
  cwd: z.string().min(1),
})
export type CliCallerContext = z.infer<typeof cliCallerContextSchema>
const withContext = <T extends z.ZodRawShape>(shape: T) => z.object({ context: cliCallerContextSchema, ...shape })

export const cliWorktreeSchema = z.object({
  id,
  projectId: id,
  branch: z.string().nullable(),
  path: z.string(),
  isMain: z.boolean(),
})
export type CliWorktree = z.infer<typeof cliWorktreeSchema>
export const cliProfileSchema = z.object({
  id,
  name: z.string(),
  providerId: z.string(),
  enabled: z.boolean(),
  isDefault: z.boolean(),
})
export type CliProfile = z.infer<typeof cliProfileSchema>
export const cliSessionSchema = z.object({
  id,
  worktreeId: id,
  profileId: z.string().nullable(),
  profileName: z.string().nullable(),
  status: z.string(),
  title: z.string().nullable(),
  /** The provider's own session id (Claude / OpenCode), once it reported one. */
  providerSessionId: z.string().nullable(),
  createdAt: z.number(),
})
export type CliSession = z.infer<typeof cliSessionSchema>
export const cliTaskSchema = z.object({
  id: z.number().int(),
  key: z.string(),
  projectId: z.string().nullable(),
  title: z.string(),
  column: z.string(),
  priority,
  labels: z.array(z.string()),
  worktreeId: z.string().nullable(),
  sessionIds: z.array(z.string()),
})
export type CliTask = z.infer<typeof cliTaskSchema>
/** Every stored comment is a draft (a delivered comment is deleted by 05). */
export const cliCommentSchema = z.object({
  id,
  worktreeId: id,
  source: z.string(),
  filePath: z.string().nullable(),
  lineStart: z.number().int().nullable(),
  lineEnd: z.number().int().nullable(),
  body: z.string(),
  createdAt: z.number(),
})
export type CliComment = z.infer<typeof cliCommentSchema>
export const cliHandoffResultSchema = z.object({
  worktree: cliWorktreeSchema,
  createdWorktree: z.boolean(),
  session: cliSessionSchema,
  taskId: z.number().int().nullable(),
  sourceTaskIds: z.array(z.number().int()),
})
export type CliHandoffResult = z.infer<typeof cliHandoffResultSchema>

/** One located transcript: the provider's location plus who owns it. */
export const cliTranscriptSchema = sessionTranscriptLocationSchema.extend({
  providerId: z.string(),
  providerSessionId: z.string(),
})
export type CliTranscript = z.infer<typeof cliTranscriptSchema>
export const cliSessionLocateResultSchema = z.object({
  /** The Pragma session the id resolved to, if Pragma knows it. */
  pragmaSessionId: z.string().nullable(),
  transcripts: z.array(cliTranscriptSchema),
})
export type CliSessionLocateResult = z.infer<typeof cliSessionLocateResultSchema>

const UPDATE_FIELDS = ['title', 'description', 'priority', 'labels'] as const
const NEEDS_UPDATE_FIELD = `pass at least one of ${UPDATE_FIELDS.join(', ')}`

export const cliRequestSchemas = {
  worktreeList: withContext({ projectId: id.optional() }),
  worktreeCreate: withContext({
    projectId: id.optional(),
    branch: text,
    baseBranch: text.optional(),
    path: text.optional(),
  }),
  agentList: withContext({ worktreeId: id.optional() }),
  agentSpawn: withContext({ worktreeId: id.optional(), profile: text, prompt: documentText.optional() }),
  profileList: withContext({}),
  taskList: withContext({ projectId: id.optional(), column: text.optional() }),
  taskCreate: withContext({
    projectId: id.optional(),
    title: text,
    description: documentText.optional(),
    column: text.optional(),
    priority: priority.optional(),
    labels: labels.optional(),
  }),
  taskUpdate: withContext({
    taskId: taskRefSchema,
    title: text.optional(),
    description: documentText.optional(),
    priority: priority.optional(),
    labels: labels.optional(),
  }).refine((r) => UPDATE_FIELDS.some((f) => r[f] !== undefined), { message: NEEDS_UPDATE_FIELD }),
  taskMove: withContext({ taskId: taskRefSchema, column: text }),
  commentsList: withContext({ worktreeId: id.optional() }),
  handoff: withContext({
    to: text,
    branch: text.optional(),
    baseBranch: text.optional(),
    sameWorktree: z.boolean(),
    document: documentText,
    taskId: taskRefSchema.optional(),
  }),
  /** A Pragma or provider session id; without one, the caller's `PRAGMA_SESSION_ID`. */
  sessionLocate: withContext({ sessionId: id.optional() }),
} satisfies Record<CliMethod, z.ZodType>

export const cliResultSchemas = {
  worktreeList: z.object({ projectId: id, worktrees: z.array(cliWorktreeSchema) }),
  worktreeCreate: cliWorktreeSchema,
  agentList: z.object({ worktreeId: id, sessions: z.array(cliSessionSchema) }),
  agentSpawn: cliSessionSchema,
  profileList: z.object({ profiles: z.array(cliProfileSchema) }),
  taskList: z.object({ projectId: id, tasks: z.array(cliTaskSchema) }),
  taskCreate: cliTaskSchema,
  taskUpdate: cliTaskSchema,
  taskMove: cliTaskSchema,
  commentsList: z.object({ worktreeId: id, comments: z.array(cliCommentSchema) }),
  handoff: cliHandoffResultSchema,
  sessionLocate: cliSessionLocateResultSchema,
} satisfies Record<CliMethod, z.ZodType>

export type CliRequest<M extends CliMethod> = z.infer<(typeof cliRequestSchemas)[M]>
export type CliResult<M extends CliMethod> = z.infer<(typeof cliResultSchemas)[M]>

export const cliErrorSchema = z.object({
  code: z.enum(CLI_ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
})
export type CliErrorDto = z.infer<typeof cliErrorSchema>

/**
 * What every `cli.*` handler answers. The bridge turns thrown errors into `handler_error` with the message only, so
 * app-side failures travel as `{ ok: false, error }` to keep their `CliErrorCode`.
 */
export const cliResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), result: z.unknown() }),
  z.object({ ok: z.literal(false), error: cliErrorSchema }),
])
export type CliResponse = z.infer<typeof cliResponseSchema>
export const cliPingResultSchema = z.object({ ok: z.literal(true), version: z.string() })
