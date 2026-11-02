import { type ChatEvent, EVENT_KIND, toAgentStatusEvent } from '../contract'
import type { ChatAgentsApi } from './agents-adapter'

export interface StatusReporter {
  onEvent(sessionId: string, e: ChatEvent, externalSessionId?: string): void
}

/** Forwards every non-null mapping to 04 (`reportEvent`); remembers the last error text per session. */
export function createStatusReporter(agents: Pick<ChatAgentsApi, 'reportStatus'>): StatusReporter {
  const lastError = new Map<string, string>()
  return {
    onEvent(sessionId, e, externalSessionId) {
      if (e.kind === EVENT_KIND.error) lastError.set(sessionId, e.message)
      const mapped = toAgentStatusEvent(e, externalSessionId, lastError.get(sessionId))
      if (e.kind === EVENT_KIND.turnEnd || e.kind === EVENT_KIND.sessionExit) lastError.delete(sessionId)
      if (mapped) agents.reportStatus(sessionId, mapped)
    },
  }
}
