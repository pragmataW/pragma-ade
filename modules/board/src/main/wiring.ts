import { type AgentStatusService, agentSessionStatusChanged } from '@pragma/module-agent-status/contract'
import { agentSessionExited, agentSessionStarted } from '@pragma/module-agents/contract'
import { projectRemoved, worktreeRemoved } from '@pragma/module-projects/contract'
import { debounce } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { CHANGE_PUSH_DEBOUNCE_MS } from '../constants'
import { boardChanged, boardIpcEvents } from '../contract'
import type { BoardRepo } from './repo'

/**
 * Main bus → renderer: every `board.changed` (from any caller, e.g. phase 10's CLI) and every removed project is
 * pushed as one debounced `board.changedEvent`; status changes of linked sessions are pushed as they come.
 */
export function wireBoardEvents(
  ctx: Pick<MainContext, 'events' | 'ipc'>,
  deps: {
    repo: BoardRepo
    handleWorktreeRemoved(worktreeId: string): void
    status: Pick<AgentStatusService, 'getStatus'> | undefined
    debounceMs?: number
  },
): void {
  const pending = new Set<string>()
  const flush = debounce(() => {
    const projectIds = [...pending]
    pending.clear()
    ctx.ipc.publish(boardIpcEvents.changed, { projectIds })
  }, deps.debounceMs ?? CHANGE_PUSH_DEBOUNCE_MS)
  const push = (projectId: string): void => {
    pending.add(projectId)
    flush()
  }
  const projectsOfSession = (sessionId: string): string[] => {
    const boards = new Set(deps.repo.listTaskIdsForSession(sessionId).map((id) => deps.repo.getTask(id)?.boardId))
    return [...boards].flatMap((id) => (id === undefined ? [] : (deps.repo.getBoard(id)?.projectId ?? [])))
  }

  ctx.events.on(boardChanged, (p) => push(p.projectId))
  ctx.events.on(projectRemoved, (p) => push(p.projectId))
  ctx.events.on(worktreeRemoved, (p) => deps.handleWorktreeRemoved(p.worktreeId))
  // A linked session started or exited: its record changed, so the board refreshes.
  const refreshSession = ({ sessionId }: { sessionId: string }): void => {
    for (const projectId of projectsOfSession(sessionId)) push(projectId)
  }
  ctx.events.on(agentSessionStarted, refreshSession)
  ctx.events.on(agentSessionExited, refreshSession)
  // Never fires when agent-status is disabled.
  ctx.events.on(agentSessionStatusChanged, ({ sessionId, status }) => {
    if (deps.repo.listTaskIdsForSession(sessionId).length === 0) return
    const turnCompleted = deps.status?.getStatus(sessionId)?.turnCompleted ?? false
    ctx.ipc.publish(boardIpcEvents.sessionStatusChanged, { sessionId, status, turnCompleted })
  })
}
