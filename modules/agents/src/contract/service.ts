import { createServiceToken, type z } from '@pragma/sdk'
import { AGENTS_SERVICE_ID, keyedEnum } from './constants'
import type { LaunchDecorator } from './launch'
import type { AgentProfile } from './profiles'
import type {
  AgentSession,
  Resume,
  relaunchOptionsSchema,
  sessionPatchSchema,
  startSessionInputSchema,
} from './sessions'

export interface ModeStartRequest {
  session: AgentSession
  profile: AgentProfile
  worktree: { id: string; path: string }
  initialPrompt?: string
  resume?: Resume
  /** Call exactly once, only when the process has really exited. */
  reportExit(exitCode: number | null): void
}

const STOP_SIGNAL_LIST = ['term', 'kill'] as const
/** `term` = graceful (SIGTERM / ConPTY close), `kill` = forced (SIGKILL). */
export const stopSignals = STOP_SIGNAL_LIST
export type StopSignal = (typeof stopSignals)[number]
export const STOP_SIGNAL = keyedEnum(stopSignals)

export interface AgentSessionModeHandler {
  start(req: ModeStartRequest): Promise<{ ptyId: string | null }>
  /** Send the signal; confirmation comes only through `reportExit`. */
  stop(session: AgentSession, signal: StopSignal): Promise<void>
}

export interface LaunchEnvContext {
  sessionId: string
  resume?: Resume
}

export interface AgentSessionsService {
  listProfiles(opts?: { launchableOnly?: boolean }): Promise<AgentProfile[]>
  getProfile(id: string): Promise<AgentProfile | null>
  startSession(input: z.input<typeof startSessionInputSchema>): Promise<AgentSession>
  /** Same row, new process (after the old one exited). */
  relaunchSession(id: string, opts?: z.input<typeof relaunchOptionsSchema>): Promise<AgentSession>
  listSessions(worktreeId: string, opts?: { includeClosed?: boolean }): Promise<AgentSession[]>
  getSession(id: string): Promise<AgentSession | null>
  /**
   * Resolves ONLY after `reportExit` confirmed the process ended: 'term' → STOP_GRACE_MS → 'kill' → KILL_CONFIRM_MS.
   * If no exit is confirmed even after 'kill', it rejects with `stopFailed` and the session stays running.
   */
  stopSession(id: string): Promise<void>
  /** Stop if running, then set `closedAt`. */
  closeSession(id: string): Promise<void>
  /** `lastFocusedAt = now` (UI focus goes through the command `agents.focusSession`). */
  focusSession(id: string): Promise<void>
  updateSession(id: string, patch: z.input<typeof sessionPatchSchema>): Promise<AgentSession>
  /** Running and open, max `lastFocusedAt`, else the newest running. */
  getLastFocusedSession(worktreeId: string): Promise<AgentSession | null>
  /** Duplicate mode throws. */
  registerModeHandler(mode: string, handler: AgentSessionModeHandler): () => void
  /** Duplicate id throws. */
  registerLaunchDecorator(decorator: LaunchDecorator): () => void
  /** §10.3: env-only decorator pipeline for non-pty launches (11a chat); the FULL env (shell env ⊕ additions). */
  buildLaunchEnv(ctx: LaunchEnvContext): Promise<Record<string, string>>
  listModes(): string[]
}

export const AgentSessionsServiceToken = createServiceToken<AgentSessionsService>(AGENTS_SERVICE_ID)
