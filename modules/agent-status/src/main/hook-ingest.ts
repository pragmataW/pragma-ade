import { type AgentSessionsService, SESSION_STATUS } from '@pragma/module-agents/contract'
import type { BridgeHandlers } from '@pragma/module-bridge/contract'
import type { Logger } from '@pragma/sdk'
import { AgentStatusEventSchema, type agentBridge, type StatusCapability } from '../contract'
import type { StatusStore } from './status-store'

export interface HookIngestDeps {
  store: StatusStore
  agents: Pick<AgentSessionsService, 'getSession'>
  statusCapability(providerId: string): StatusCapability | undefined
  log: Pick<Logger, 'warn'>
}

const REJECTED = { accepted: false } as const
const ACCEPTED = { accepted: true } as const

/** `agent.hookEvent`: parsed by the SESSION's provider (never the payload's), applied to its tracker. */
export function createHookEventHandler(deps: HookIngestDeps): BridgeHandlers<typeof agentBridge> {
  return {
    async hookEvent({ sessionId, event }) {
      const tracker = deps.store.get(sessionId)
      if (!tracker || tracker.state.status === SESSION_STATUS.exited) return REJECTED
      const session = await deps.agents.getSession(sessionId)
      const cap = session ? deps.statusCapability(session.providerId) : undefined
      if (!cap) return REJECTED
      const parsed = cap.parseEvent(event)
      if (parsed === null) return ACCEPTED
      const valid = AgentStatusEventSchema.safeParse(parsed)
      if (!valid.success) {
        deps.log.warn(`invalid status event from the ${session?.providerId} capability`, valid.error.message)
        return REJECTED
      }
      tracker.applyEvent(valid.data)
      return ACCEPTED
    },
  }
}
