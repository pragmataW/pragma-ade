import type { BoardSection, BoardService, ColumnDto, TaskDto } from '@pragma/module-board/contract'
import { BOARD_MODULE_ID } from '../../constants'
import { CLI_ERROR, CLI_METHOD, type CliCallerContext, type CliRequest } from '../../contract'
import { CliError } from '../cli-error'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { requireService } from '../lib/require-service'
import { toCliTask } from '../mappers'
import { resolveProjectId } from '../resolve-context'
import type { CliHandlerDeps } from './types'

type TaskMethod = 'taskList' | 'taskCreate' | 'taskUpdate' | 'taskMove'
const LIST_JOIN = ', '

/** `board.getTask(ref)` (id, digit string or key); null → `not_found`. */
export async function resolveTask(board: BoardService, ref: string): Promise<TaskDto> {
  const task = await board.getTask(ref)
  if (!task) throw new CliError(CLI_ERROR.not_found, `Task '${ref}' not found.`)
  return task
}

/** Cards linked to an agent session (§10.3). */
export const findTasksForSession = (board: BoardService, sessionId: string): Promise<TaskDto[]> =>
  board.listTasks({ sessionId })

/** Case-insensitive column name within one board; unknown → `not_found` listing the board's columns. */
function resolveColumn(section: BoardSection, name: string): ColumnDto {
  const wanted = name.trim().toLowerCase()
  const column = section.columns.find((c) => c.name.toLowerCase() === wanted)
  if (column) return column
  const names = section.columns.map((c) => c.name).join(LIST_JOIN)
  throw new CliError(CLI_ERROR.not_found, `Column '${name}' not found. Columns: ${names}.`)
}

type TaskFields = Pick<CliRequest<'taskCreate'>, 'title' | 'description' | 'priority' | 'labels'>

/** CLI fields → 09's patch shape (`description` → `descriptionMd`); only fields that were given. */
function boardFields(req: Partial<TaskFields>) {
  return {
    ...(req.title !== undefined ? { title: req.title } : {}),
    ...(req.description !== undefined ? { descriptionMd: req.description } : {}),
    ...(req.priority !== undefined ? { priority: req.priority } : {}),
    ...(req.labels !== undefined ? { labels: req.labels } : {}),
  }
}

export function taskHandlers(deps: CliHandlerDeps): Record<TaskMethod, CliHandler> {
  const board = () => requireService(deps.board, BOARD_MODULE_ID)
  const mapped = async (b: BoardService, t: TaskDto) => toCliTask(t, await b.getBoard(t.projectId))
  /** Board, project, its section and the optional `--column` filter of a project-scoped request. */
  const projectScope = async (req: { projectId?: string; column?: string; context: CliCallerContext }) => {
    const b = board()
    const projectId = await resolveProjectId(deps.projects, req.projectId, req.context)
    const section = await b.getBoard(projectId)
    const column = req.column === undefined ? {} : { column: resolveColumn(section, req.column).id }
    return { b, projectId, section, column }
  }
  return {
    taskList: defineCliHandler(CLI_METHOD.taskList, async (req) => {
      const { b, projectId, section, column } = await projectScope(req)
      const tasks = await b.listTasks({ projectId, ...column })
      return { projectId, tasks: tasks.map((t) => toCliTask(t, section)) }
    }),
    taskCreate: defineCliHandler(CLI_METHOD.taskCreate, async (req) => {
      const { b, projectId, column } = await projectScope(req)
      // Re-read the board after the create: it may have added labels the pre-create section does not know.
      return mapped(b, await b.createTask({ projectId, title: req.title, ...boardFields(req), ...column }))
    }),
    taskUpdate: defineCliHandler(CLI_METHOD.taskUpdate, async (req) => {
      const b = board()
      const task = await resolveTask(b, req.taskId)
      return mapped(b, await b.updateTask(task.id, boardFields(req)))
    }),
    taskMove: defineCliHandler(CLI_METHOD.taskMove, async (req) => {
      const b = board()
      const task = await resolveTask(b, req.taskId)
      const column = resolveColumn(await b.getBoard(task.projectId), req.column)
      return mapped(b, await b.moveTask(task.id, column.id))
    }),
  }
}
