import type { Disposable } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { AgentStatusIpc, AgentStatusIpcEvents, type SessionStatusInfo, type WorktreeStatusInfo } from '../contract'
import type { StatusStore } from './status-store'

/** Renderer pulls the full state once (`list`) and then follows `sessionChanged` / `worktreeChanged`. */
export function registerStatusIpc(ipc: MainContext['ipc'], store: () => StatusStore): Disposable {
  return ipc.handle(AgentStatusIpc.list, () => {
    const s = store()
    return { sessions: s.list(), worktrees: s.worktreeIds().map((id) => s.worktree(id)) }
  })
}

export function statusPublisher(ipc: MainContext['ipc']): {
  session(i: SessionStatusInfo): void
  worktree(i: WorktreeStatusInfo): void
} {
  return {
    session: (i) => ipc.publish(AgentStatusIpcEvents.sessionChanged, i),
    worktree: (i) => ipc.publish(AgentStatusIpcEvents.worktreeChanged, i),
  }
}
