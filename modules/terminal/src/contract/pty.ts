import { createServiceToken, z } from '@pragma/sdk'
import { type KillSignal, type PtyInfo, PtySizeSchema, type PtySnapshot } from '@pragma/terminal-pty-daemon/protocol'

/** DTOs are owned by the daemon protocol (single source of truth) and re-exported here. */
export {
  KILL_SIGNALS,
  type KillSignal,
  PTY_STATUS,
  PTY_STATUSES,
  type PtyInfo,
  PtyInfoSchema,
  type PtySize,
  PtySizeSchema,
  type PtySnapshot,
  PtySnapshotSchema,
  type PtyStatus,
} from '@pragma/terminal-pty-daemon/protocol'

export const PtySpawnOptionsSchema = z
  .object({
    cwd: z.string(),
    /** Omitted: the default shell. Bare names are resolved with `ctx.env.resolveCommand`. */
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    /** Added to (and overriding) the login-shell environment. */
    env: z.record(z.string(), z.string()).optional(),
    /** Free-form owner tags, e.g. `{ owner: 'terminal', worktreeId }` or `{ owner: 'agents', sessionId }`. */
    tags: z.record(z.string(), z.string()).optional(),
  })
  .extend(PtySizeSchema.shape)
export type PtySpawnOptions = z.infer<typeof PtySpawnOptionsSchema>

export const PTY_EXIT_REASON = { exited: 'exited', killed: 'killed', daemonRestarted: 'daemon-restarted' } as const
export const PTY_EXIT_REASONS = [
  PTY_EXIT_REASON.exited,
  PTY_EXIT_REASON.killed,
  PTY_EXIT_REASON.daemonRestarted,
] as const
export type PtyExitReason = (typeof PTY_EXIT_REASONS)[number]
export const PtyExitSchema = z.object({
  ptyId: z.string(),
  exitCode: z.number().nullable(),
  signal: z.number().nullable(),
  reason: z.enum(PTY_EXIT_REASONS),
})
export type PtyExit = z.infer<typeof PtyExitSchema>

export const PTY_SPAWN_ERROR = {
  cwdNotFound: 'CWD_NOT_FOUND',
  spawnFailed: 'SPAWN_FAILED',
  unavailable: 'UNAVAILABLE',
} as const
export const PTY_SPAWN_ERROR_CODES = [
  PTY_SPAWN_ERROR.cwdNotFound,
  PTY_SPAWN_ERROR.spawnFailed,
  PTY_SPAWN_ERROR.unavailable,
] as const
export type PtySpawnErrorCode = (typeof PTY_SPAWN_ERROR_CODES)[number]

/** `spawn` rejects with this; no session is left behind. */
export class PtySpawnError extends Error {
  readonly code: PtySpawnErrorCode
  constructor(code: PtySpawnErrorCode, message: string) {
    super(message)
    this.name = 'PtySpawnError'
    this.code = code
  }
}

/** Main-side pty service (§7, §10.3), provided by `terminal`. Knows nothing about agents. */
export interface PtyService {
  /** Resolves with the ptyId; rejects with `PtySpawnError`. */
  spawn(opts: PtySpawnOptions): Promise<string>
  write(ptyId: string, data: string): void
  /** Bracketed iff the program enabled mode 2004. */
  paste(ptyId: string, text: string): void
  /** From the daemon's `modes` events (DECSET/DECRST 2004); false for unknown or exited ptys. */
  isBracketedPasteEnabled(ptyId: string): boolean
  resize(ptyId: string, cols: number, rows: number): void
  /** Default SIGTERM (win32: the process is terminated). Resolves after the confirmed exit, then forgets the pty. */
  kill(ptyId: string, signal?: KillSignal): Promise<void>
  onData(ptyId: string, cb: (data: string) => void): () => void
  /** Data sent with `write` (keyboard input of views and services; not pastes), after it was sent to the pty. */
  onInput(ptyId: string, cb: (data: string) => void): () => void
  /** Fires once; asynchronously at once when the pty already exited. */
  onExit(ptyId: string, cb: (exit: PtyExit) => void): () => void
  /** Thin delegate to the SDK's `ctx.env.getShellEnv()`. */
  getShellEnv(): Promise<Record<string, string>>
  get(ptyId: string): PtyInfo | undefined
  list(filter?: { tags?: Record<string, string> }): PtyInfo[]
  snapshot(ptyId: string): Promise<PtySnapshot>
}

export const PtyServiceToken = createServiceToken<PtyService>('terminal.pty')

/** Tag key/value the terminal panel puts on the ptys it owns. */
export const TERMINAL_TAG_OWNER = 'owner'
export const TERMINAL_OWNER_PANEL = 'terminal'
export const TERMINAL_TAG_WORKTREE = 'worktreeId'
