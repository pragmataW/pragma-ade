import { z } from 'zod'

/** Wire protocol between main (`DaemonHost`) and the pty-daemon. Owns the pty DTOs; the module contract re-exports them. */
export const PROTOCOL_VERSION = 1
export const MAX_COLS = 1000
export const MAX_ROWS = 500
/** Terminal type announced to programs (main sets `TERM`, the daemon names the pty). */
export const TERM_NAME = 'xterm-256color'

export const KILL_SIGNALS = ['SIGTERM', 'SIGKILL', 'SIGINT'] as const
export type KillSignal = (typeof KILL_SIGNALS)[number]
export const DEFAULT_KILL_SIGNAL: KillSignal = 'SIGTERM'

export const PTY_STATUSES = ['running', 'exited'] as const
export type PtyStatus = (typeof PTY_STATUSES)[number]

export const DAEMON_ERROR_CODES = ['NOT_FOUND', 'CWD_NOT_FOUND', 'SPAWN_FAILED', 'BAD_REQUEST', 'INTERNAL'] as const
export type DaemonErrorCode = (typeof DAEMON_ERROR_CODES)[number]
export const DAEMON_ERROR = {
  notFound: 'NOT_FOUND',
  cwdNotFound: 'CWD_NOT_FOUND',
  spawnFailed: 'SPAWN_FAILED',
  badRequest: 'BAD_REQUEST',
  internal: 'INTERNAL',
} as const satisfies Record<string, DaemonErrorCode>

const ptyId = z.string()
const cols = z.number().int().min(1).max(MAX_COLS)
const rows = z.number().int().min(1).max(MAX_ROWS)

export const PtySizeSchema = z.object({ cols, rows })
export type PtySize = z.infer<typeof PtySizeSchema>

export const SpawnSpecSchema = z.object({
  cwd: z.string(),
  /** Absolute path or a bare name looked up on the env's PATH by node-pty. */
  command: z.string(),
  args: z.array(z.string()),
  env: z.record(z.string(), z.string()),
  scrollback: z.number().int().nonnegative(),
  tags: z.record(z.string(), z.string()),
  cols,
  rows,
})
export type SpawnSpec = z.infer<typeof SpawnSpecSchema>

export const PtyInfoSchema = z.object({
  ptyId,
  pid: z.number().int(),
  cwd: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  tags: z.record(z.string(), z.string()),
  cols,
  rows,
  status: z.enum(PTY_STATUSES),
  exitCode: z.number().nullable(),
  signal: z.number().nullable(),
  createdAt: z.number(),
  bracketedPaste: z.boolean(),
})
export type PtyInfo = z.infer<typeof PtyInfoSchema>

export const PtySnapshotSchema = z.object({ data: z.string(), seq: z.number().int().nonnegative(), cols, rows })
export type PtySnapshot = z.infer<typeof PtySnapshotSchema>

const id = z.number().int()
const ref = { id, ptyId }

export const DaemonRequestSchema = z.discriminatedUnion('type', [
  z.object({ id, type: z.literal('spawn'), spec: SpawnSpecSchema }),
  z.object({ ...ref, type: z.literal('write'), data: z.string() }),
  z.object({ ...ref, type: z.literal('paste'), text: z.string() }),
  z.object({ ...ref, type: z.literal('resize'), cols, rows }),
  z.object({ ...ref, type: z.literal('kill'), signal: z.enum(KILL_SIGNALS).optional() }),
  z.object({ ...ref, type: z.literal('snapshot') }),
  z.object({ ...ref, type: z.literal('readText') }),
  z.object({ id, type: z.literal('list') }),
  z.object({ id, type: z.literal('shutdown') }),
])
export type DaemonRequest = z.infer<typeof DaemonRequestSchema>
export type DaemonRequestType = DaemonRequest['type']
/** A request before main assigns its `id`. */
export type DaemonRequestInput = DaemonRequest extends infer R
  ? R extends { id: number }
    ? Omit<R, 'id'>
    : never
  : never

export const DaemonErrorSchema = z.object({ code: z.enum(DAEMON_ERROR_CODES), message: z.string() })
export type DaemonError = z.infer<typeof DaemonErrorSchema>

export const DaemonResponseSchema = z.discriminatedUnion('ok', [
  z.object({ kind: z.literal('response'), id, ok: z.literal(true), result: z.unknown() }),
  z.object({ kind: z.literal('response'), id, ok: z.literal(false), error: DaemonErrorSchema }),
])
export type DaemonResponse = z.infer<typeof DaemonResponseSchema>

export const DaemonEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('ready'), pid: z.number().int(), protocolVersion: z.number().int() }),
  z.object({ kind: z.literal('data'), ptyId, seq: z.number().int(), data: z.string() }),
  z.object({ kind: z.literal('modes'), ptyId, bracketedPaste: z.boolean() }),
  z.object({ kind: z.literal('exit'), ptyId, exitCode: z.number().nullable(), signal: z.number().nullable() }),
])
export type DaemonEvent = z.infer<typeof DaemonEventSchema>

/** Anything the daemon sends to main. */
export const DaemonMessageSchema = z.union([DaemonResponseSchema, DaemonEventSchema])
export type DaemonMessage = z.infer<typeof DaemonMessageSchema>
