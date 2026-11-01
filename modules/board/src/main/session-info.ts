import type { AgentStatusService } from '@pragma/module-agent-status/contract'
import type { AgentSessionsService } from '@pragma/module-agents/contract'
import type { AgentSessionId, LinkedSessionDto } from '../contract'

/** Enriches linked session ids for task DTOs; the status comes from agent-status when it is enabled. */
export interface SessionInfo {
  /** Sessions whose record is gone are skipped. */
  describe(sessionIds: AgentSessionId[]): Promise<LinkedSessionDto[]>
  readonly statusAvailable: boolean
}

export function createSessionInfo(deps: {
  sessions: Pick<AgentSessionsService, 'getSession' | 'getProfile'>
  status?: Pick<AgentStatusService, 'getStatus'>
}): SessionInfo {
  const { sessions, status } = deps
  async function one(id: AgentSessionId): Promise<LinkedSessionDto | null> {
    const session = await sessions.getSession(id)
    if (!session) return null
    const profile = session.profileId ? await sessions.getProfile(session.profileId) : null
    const info = status?.getStatus(id) ?? null
    return {
      sessionId: id,
      worktreeId: session.worktreeId,
      title: session.title || null,
      status: info?.status ?? null,
      turnCompleted: info?.turnCompleted ?? false,
      profileId: session.profileId,
      profileName: profile?.name ?? null,
      profileDisplayNameKey: profile?.displayNameKey ?? null,
      providerId: session.providerId,
    }
  }
  return {
    statusAvailable: status !== undefined,
    async describe(ids) {
      const all = await Promise.all([...new Set(ids)].map(one))
      return all.filter((s): s is LinkedSessionDto => s !== null)
    },
  }
}
