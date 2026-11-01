import { z } from '@pragma/sdk'
import { keyedEnum, SESSION_TITLE_MAX, TERMINAL_MODE } from './constants'
import { agentsErrorCodes } from './errors'

const AGENT_SESSION_STATUS_LIST = ['starting', 'working', 'waiting', 'idle', 'exited', 'error'] as const
export const agentSessionStatuses = AGENT_SESSION_STATUS_LIST
export type AgentSessionStatus = (typeof agentSessionStatuses)[number]
export const SESSION_STATUS = keyedEnum(agentSessionStatuses)

export const agentSessionSchema = z.object({
  id: z.string(),
  worktreeId: z.string(),
  profileId: z.string().nullable(),
  providerId: z.string(),
  /** `TERMINAL_MODE` or a registered mode (`chat` from 11a). */
  mode: z.string(),
  ptyId: z.string().nullable(),
  /** Stored title, else `t('agents:session.untitled', { n: ordinal })`. */
  title: z.string(),
  ordinal: z.number().int(),
  status: z.enum(agentSessionStatuses),
  externalSessionId: z.string().nullable(),
  exitCode: z.number().int().nullable(),
  error: z.object({ code: z.enum(agentsErrorCodes), message: z.string() }).nullable(),
  createdAt: z.number(),
  endedAt: z.number().nullable(),
  closedAt: z.number().nullable(),
  lastFocusedAt: z.number().nullable(),
  /** The pty was spawned in this main-process lifetime (a terminal view can attach). */
  attachable: z.boolean(),
})
export type AgentSession = z.infer<typeof agentSessionSchema>

/** 11c: resume a provider session; `serverUrl` when an existing server hosts it. */
export const resumeSchema = z.object({ externalSessionId: z.string().min(1), serverUrl: z.string().url().optional() })
export type Resume = z.infer<typeof resumeSchema>

export const startSessionInputSchema = z.object({
  /** With `newWorktree`: the SOURCE worktree (gives the project). */
  worktreeId: z.string().min(1),
  profileId: z.string().optional(),
  initialPrompt: z.string().optional(),
  mode: z.string().default(TERMINAL_MODE),
  resume: resumeSchema.optional(),
  /** "Run in: New worktree from <base>" (ui-notes 6a): main creates it and starts the session there. */
  newWorktree: z.object({ branch: z.string().trim().min(1), baseBranch: z.string().optional() }).optional(),
})
export type StartSessionInput = z.input<typeof startSessionInputSchema>

export const newWorktreeDefaultsSchema = z.object({ baseBranch: z.string() })
export type NewWorktreeDefaults = z.infer<typeof newWorktreeDefaultsSchema>

export const relaunchOptionsSchema = z.object({
  mode: z.string().optional(),
  initialPrompt: z.string().optional(),
  resume: resumeSchema.optional(),
})
export type RelaunchOptions = z.input<typeof relaunchOptionsSchema>

export const sessionPatchSchema = z.object({
  status: z.enum(agentSessionStatuses).optional(),
  externalSessionId: z.string().nullable().optional(),
  title: z.string().max(SESSION_TITLE_MAX).nullable().optional(),
  ptyId: z.string().nullable().optional(),
  mode: z.string().optional(),
  exitCode: z.number().int().nullable().optional(),
  endedAt: z.number().nullable().optional(),
})
export type SessionPatch = z.infer<typeof sessionPatchSchema>

const ENDED_STATUSES = new Set<AgentSessionStatus>([SESSION_STATUS.exited, SESSION_STATUS.error])
export const isRunningStatus = (s: AgentSessionStatus): boolean => !ENDED_STATUSES.has(s)
