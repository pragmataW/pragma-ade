import { defineEvent, z } from '@pragma/sdk'
import { AGENTS_EVENTS } from './constants'
import { agentSessionSchema } from './sessions'

export const agentSessionStartedPayloadSchema = z
  .object({ sessionId: z.string() })
  .extend(
    agentSessionSchema.pick({ worktreeId: true, profileId: true, providerId: true, mode: true, ptyId: true }).shape,
  )
export type AgentSessionStartedPayload = z.infer<typeof agentSessionStartedPayloadSchema>

export const agentSessionExitedPayloadSchema = z
  .object({ sessionId: z.string() })
  .extend(agentSessionSchema.pick({ worktreeId: true, exitCode: true }).shape)
export type AgentSessionExitedPayload = z.infer<typeof agentSessionExitedPayloadSchema>

export const agentSessionUpdatedPayloadSchema = z.object({
  session: agentSessionSchema,
  changed: z.array(agentSessionSchema.keyof()),
})
export type AgentSessionUpdatedPayload = z.infer<typeof agentSessionUpdatedPayloadSchema>

/** Main event bus. `updated` follows every persisted change (start, exit, close, focus, `updateSession`). */
export const agentSessionStarted = defineEvent<AgentSessionStartedPayload>(AGENTS_EVENTS.started)
export const agentSessionExited = defineEvent<AgentSessionExitedPayload>(AGENTS_EVENTS.exited)
export const agentSessionUpdated = defineEvent<AgentSessionUpdatedPayload>(AGENTS_EVENTS.updated)
