import type { ColumnId } from '@pragma/module-board/contract'
import { BOARD_MODULE_ID } from '../../constants'
import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { requireService } from '../lib/require-service'
import { toCliColumn, toCliTaskDetail } from '../mappers'
import { resolveProjectId } from '../resolve-context'
import { resolveTask } from './task'
import type { CliHandlerDeps } from './types'

type BoardMethod = 'taskColumns' | 'taskShow'

/** Read-only board views for agents working the board; every call reads the app's live board (no caching). */
export function boardHandlers(deps: CliHandlerDeps): Record<BoardMethod, CliHandler> {
  const board = () => requireService(deps.board, BOARD_MODULE_ID)
  /** A gone worktree shows as its id only. */
  const branchOf = async (worktreeId: string | null): Promise<string | null> =>
    worktreeId ? ((await deps.projects.getWorktree(worktreeId).catch(() => null))?.branch ?? null) : null
  return {
    taskColumns: defineCliHandler(CLI_METHOD.taskColumns, async (req) => {
      const b = board()
      const projectId = await resolveProjectId(deps.projects, req.projectId, req.context)
      const section = await b.getBoard(projectId)
      const counts = new Map<ColumnId, number>()
      for (const t of await b.listTasks({ projectId })) counts.set(t.columnId, (counts.get(t.columnId) ?? 0) + 1)
      return { projectId, columns: section.columns.map((c) => toCliColumn(c, counts.get(c.id) ?? 0)) }
    }),
    taskShow: defineCliHandler(CLI_METHOD.taskShow, async (req) => {
      const b = board()
      const task = await resolveTask(b, req.taskId)
      return toCliTaskDetail(task, await b.getBoard(task.projectId), await branchOf(task.worktreeId))
    }),
  }
}
