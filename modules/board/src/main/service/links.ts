import { CHANGE_KIND, type TaskId } from '../../contract'
import type { BoardCore } from './core'

/** Task ↔ agent session links and the worktree-removed cleanup. */
export function createLinkOps(core: BoardCore) {
  const { repo } = core
  return {
    async linkSession(taskId: TaskId, sessionId: string): Promise<void> {
      const task = core.requireTask(taskId)
      repo.insertSessionLink(taskId, sessionId, core.now())
      core.changed(core.requireBoard(task.boardId), [taskId], CHANGE_KIND.link)
    },
    async unlinkSession(taskId: TaskId, sessionId: string): Promise<void> {
      const task = core.requireTask(taskId)
      repo.deleteSessionLink(taskId, sessionId)
      core.changed(core.requireBoard(task.boardId), [taskId], CHANGE_KIND.link)
    },
    /** `worktree.removed`: clears the link on every task (one change per affected board). */
    handleWorktreeRemoved(worktreeId: string): void {
      const ids = repo.transaction(() => repo.clearWorktree(worktreeId))
      const byBoard = new Map<number, number[]>()
      for (const id of ids) {
        const boardId = core.requireTask(id).boardId
        byBoard.set(boardId, [...(byBoard.get(boardId) ?? []), id])
      }
      for (const [boardId, taskIds] of byBoard) core.changed(core.requireBoard(boardId), taskIds)
    },
  }
}
