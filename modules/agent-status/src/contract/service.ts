import { createServiceToken, defineEvent } from '@pragma/sdk'
import { AGENT_STATUS_SERVICE_ID, STATUS_CHANGED_EVENT } from './constants'
import type { AgentStatus, AgentStatusEvent, SessionStatusInfo, WorktreeStatusInfo } from './status'

/** `AgentStatusServiceToken` (§7, §10.3). */
export interface AgentStatusService {
  /** null = not tracked in this app run. */
  getStatus(sessionId: string): SessionStatusInfo | null
  /** `status` is null when the worktree has no tracked sessions. */
  getWorktreeStatus(worktreeId: string): WorktreeStatusInfo
  /**
   * Status from elsewhere (chat sessions, 11a). Validates the event; an untracked session is looked up via
   * `AgentSessionsService` and tracked as `external`. Resolves false for an unknown or exited session.
   */
  reportEvent(sessionId: string, event: AgentStatusEvent): Promise<boolean>
}
export const AgentStatusServiceToken = createServiceToken<AgentStatusService>(AGENT_STATUS_SERVICE_ID)

export interface AgentSessionStatusChangedPayload {
  sessionId: string
  status: AgentStatus
  externalSessionId?: string
}
/** §4.4 `agentSession.statusChanged`. */
export const agentSessionStatusChanged = defineEvent<AgentSessionStatusChangedPayload>(STATUS_CHANGED_EVENT)
