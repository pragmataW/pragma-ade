import { agentSessionStatuses } from '@pragma/module-agents/contract'
import { z } from '@pragma/sdk'
import { HOOK_FIELD_MAX_CHARS, HOOK_ID_MAX_CHARS, EVENT_KIND as K, STATUS_SOURCES, WAIT_REASONS } from './constants'

/** Single source: 03's `agentSessionStatuses`. */
export const AgentStatusSchema = z.enum(agentSessionStatuses)
export type AgentStatus = z.infer<typeof AgentStatusSchema>

const field = z.string().max(HOOK_FIELD_MAX_CHARS).optional()
const ext = { externalSessionId: z.string().max(HOOK_ID_MAX_CHARS).optional() }
const plain = <T extends string>(kind: T) => z.object({ kind: z.literal(kind), ...ext })

/** Provider-neutral status events (parsed from hook payloads by each provider's `status` capability). */
export const AgentStatusEventSchema = z.discriminatedUnion('kind', [
  plain(K.sessionStarted),
  plain(K.promptSubmitted),
  z.object({ kind: z.literal(K.toolStarted), toolName: field, ...ext }),
  plain(K.toolFinished),
  z.object({ kind: z.literal(K.waitingForUser), reason: z.enum(WAIT_REASONS), ...ext }),
  plain(K.userResponded),
  plain(K.turnCompleted),
  plain(K.turnInterrupted),
  z.object({ kind: z.literal(K.turnFailed), message: field, ...ext }),
  plain(K.sessionEnded),
])
export type AgentStatusEvent = z.infer<typeof AgentStatusEventSchema>

export const SessionStatusInfoSchema = z.object({
  sessionId: z.string(),
  worktreeId: z.string(),
  status: AgentStatusSchema,
  /** `idle` after a completed turn (shown as "done"). */
  turnCompleted: z.boolean(),
  source: z.enum(STATUS_SOURCES),
  externalSessionId: z.string().optional(),
  /** Current action (tool name) or error message. */
  detail: z.string().optional(),
  unread: z.boolean(),
  updatedAt: z.number(),
})
export type SessionStatusInfo = z.infer<typeof SessionStatusInfoSchema>

export const StatusSummarySchema = z.object({
  status: AgentStatusSchema.nullable(),
  turnCompleted: z.boolean(),
  unreadCount: z.number().int(),
  sessionCount: z.number().int(),
})
export type StatusSummary = z.infer<typeof StatusSummarySchema>

export const WorktreeStatusInfoSchema = StatusSummarySchema.extend({ worktreeId: z.string() })
export type WorktreeStatusInfo = z.infer<typeof WorktreeStatusInfoSchema>

/** The event with `externalSessionId` set when `id` is non-empty (provider parsers use this). */
export const withExternalSessionId = (event: AgentStatusEvent, id: string | undefined): AgentStatusEvent =>
  id ? { ...event, externalSessionId: id } : event
