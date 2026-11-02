import { type AgentSessionsService, SESSION_STATUS } from '@pragma/module-agents/contract'
import type { BridgeHandlers } from '@pragma/module-bridge/contract'
import type { Logger } from '@pragma/sdk'
import { type AgentStatusEvent, AgentStatusEventSchema, type agentBridge, type StatusCapability } from '../contract'
import type { StatusStore } from './status-store'
import type { SessionTracker } from './tracker'

export interface HookIngestDeps {
  store: StatusStore
  agents: Pick<AgentSessionsService, 'getSession'>
  statusCapability(providerId: string): StatusCapability | undefined
  log: Pick<Logger, 'warn'>
}

const REJECTED = { accepted: false } as const
const ACCEPTED = { accepted: true } as const

type Log = HookIngestDeps['log']

/** The event when it matches the schema; otherwise logs and returns null. */
function validEvent(event: AgentStatusEvent, providerId: string, log: Log): AgentStatusEvent | null {
  const valid = AgentStatusEventSchema.safeParse(event)
  if (valid.success) return valid.data
  log.warn(`invalid status event from the ${providerId} capability`, valid.error.message)
  return null
}

/** The tracker's monitor, created by the capability on the first hook event (none without `monitorSession`). */
function monitorOf(tracker: SessionTracker, cap: StatusCapability, providerId: string, log: Log) {
  if (tracker.monitor || !cap.monitorSession) return tracker.monitor
  tracker.attachMonitor(
    cap.monitorSession({
      report(event) {
        const valid = validEvent(event, providerId, log)
        if (valid && tracker.monitor) tracker.applyEvent(valid)
      },
    }),
  )
  return tracker.monitor
}

/** Applies one payload of a live session: parsed event to the tracker, then the payload to the monitor. */
function ingest(tracker: SessionTracker, cap: StatusCapability, providerId: string, event: unknown, log: Log) {
  const parsed = cap.parseEvent(event)
  const valid = parsed === null ? null : validEvent(parsed, providerId, log)
  if (parsed !== null && valid === null) return REJECTED
  if (valid) tracker.applyEvent(valid)
  monitorOf(tracker, cap, providerId, log)?.onHookEvent(event, valid)
  return ACCEPTED
}

/**
 * `agent.hookEvent`: parsed by the SESSION's provider (never the payload's), applied to its tracker, then shown to
 * the provider's session monitor.
 */
export function createHookEventHandler(deps: HookIngestDeps): BridgeHandlers<typeof agentBridge> {
  return {
    async hookEvent({ sessionId, event }) {
      const tracker = deps.store.get(sessionId)
      if (!tracker || tracker.state.status === SESSION_STATUS.exited) return REJECTED
      const session = await deps.agents.getSession(sessionId)
      const cap = session ? deps.statusCapability(session.providerId) : undefined
      if (!session || !cap) return REJECTED
      return ingest(tracker, cap, session.providerId, event, deps.log)
    },
  }
}
