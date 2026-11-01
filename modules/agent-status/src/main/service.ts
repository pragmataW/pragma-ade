import { type AgentSessionsService, SESSION_STATUS } from '@pragma/module-agents/contract'
import { AgentStatusEventSchema, type AgentStatusService, STATUS_SOURCE } from '../contract'
import type { StatusStore } from './status-store'

/** `AgentStatusServiceToken`; `reportEvent` is how 11a reports chat-session status. */
export function createAgentStatusService(deps: {
  store: StatusStore
  agents: Pick<AgentSessionsService, 'getSession'>
}): AgentStatusService {
  return {
    getStatus: (sessionId) => deps.store.info(sessionId),
    getWorktreeStatus: (worktreeId) => deps.store.worktree(worktreeId),
    async reportEvent(sessionId, event) {
      const valid = AgentStatusEventSchema.parse(event)
      let tracker = deps.store.get(sessionId)
      if (!tracker) {
        const session = await deps.agents.getSession(sessionId)
        if (!session) return false
        tracker = deps.store.track({ sessionId, worktreeId: session.worktreeId, source: STATUS_SOURCE.external })
      }
      if (tracker.state.status === SESSION_STATUS.exited) return false
      tracker.setSource(STATUS_SOURCE.external)
      tracker.applyEvent(valid)
      return true
    },
  }
}
