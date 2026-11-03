import type { ColumnId } from '@pragma/module-board/contract'
import { BOARD_MODULE_ID } from '../../constants'
import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { requireService } from '../lib/require-service'
import { toCliColumn } from '../mappers'
import { resolveProjectId } from '../resolve-context'
import type { CliHandlerDeps } from './types'

type BoardMethod = 'taskColumns'

/** Read-only board views for agents working the board; every call reads the app's live board (no caching). */
export function boardHandlers(deps: CliHandlerDeps): Record<BoardMethod, CliHandler> {
  const board = () => requireService(deps.board, BOARD_MODULE_ID)
  return {
    taskColumns: defineCliHandler(CLI_METHOD.taskColumns, async (req) => {
      const b = board()
      const projectId = await resolveProjectId(deps.projects, req.projectId, req.context)
      const section = await b.getBoard(projectId)
      const counts = new Map<ColumnId, number>()
      for (const t of await b.listTasks({ projectId })) counts.set(t.columnId, (counts.get(t.columnId) ?? 0) + 1)
      return { projectId, columns: section.columns.map((c) => toCliColumn(c, counts.get(c.id) ?? 0)) }
    }),
  }
}
