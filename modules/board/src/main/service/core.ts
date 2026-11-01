import type { Project, ProjectsService } from '@pragma/module-projects/contract'
import { DIGITS_RE, FIRST_DUPLICATE_SUFFIX, TASK_KEY_RE } from '../../constants'
import {
  BOARD_ERROR,
  type BoardChangedPayload,
  BoardError,
  type BoardSection,
  CHANGE_KIND,
  type ColumnRef,
  DEFAULT_COLUMN_NAMES,
  type TaskDto,
  type TaskPosition,
  type TaskRef,
} from '../../contract'
import { columnMergeKey } from '../../lib/merge-columns'
import { toBoardDto, toColumnDto, toLabelDto, toTaskDto } from '../lib/mappers'
import { initialRanks } from '../rank'
import type { BoardRepo } from '../repo'
import type { BoardRow, ColumnRow, TaskRow } from '../schema'
import type { SessionInfo } from '../session-info'
import { keyPrefixFor } from '../task-text'

export type BoardProjects = Pick<
  ProjectsService,
  'listProjects' | 'getProject' | 'listWorktrees' | 'getWorktree' | 'createWorktree' | 'listBranches'
>

export interface BoardCoreDeps {
  repo: BoardRepo
  projects: BoardProjects
  sessions: SessionInfo
  emit(p: BoardChangedPayload): void
  now(): number
}

const notFound = (what: string): BoardError => new BoardError(BOARD_ERROR.not_found, `${what} not found`)

/** Shared lookups, DTO building and change emission used by every service part. */
export function createBoardCore(deps: BoardCoreDeps) {
  const { repo, projects, sessions } = deps

  function uniquePrefix(base: string): string {
    const taken = new Set(repo.listBoards().map((b) => b.keyPrefix))
    if (!taken.has(base)) return base
    for (let n = FIRST_DUPLICATE_SUFFIX; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`
  }

  function createBoard(project: Project): BoardRow {
    return repo.transaction(() => {
      const existing = repo.findBoardByProject(project.id)
      if (existing) return existing
      const board = repo.insertBoard({
        projectId: project.id,
        name: project.name,
        keyPrefix: uniquePrefix(keyPrefixFor(project.name)),
        createdAt: deps.now(),
      })
      const ranks = initialRanks(DEFAULT_COLUMN_NAMES.length)
      DEFAULT_COLUMN_NAMES.forEach((name, i) => {
        repo.insertColumn({ boardId: board.id, name, sortOrder: ranks[i] as string })
      })
      return board
    })
  }

  async function requireProject(projectId: string): Promise<Project> {
    const project = await projects.getProject(projectId)
    if (!project) throw notFound(`project ${projectId}`)
    return project
  }

  const requireBoard = (id: number): BoardRow => {
    const b = repo.getBoard(id)
    if (!b) throw notFound(`board ${id}`)
    return b
  }

  const requireTask = (id: number): TaskRow => {
    const t = repo.getTask(id)
    if (!t) throw notFound(`task ${id}`)
    return t
  }

  const requireColumn = (id: number): ColumnRow => {
    const c = repo.getColumn(id)
    if (!c) throw new BoardError(BOARD_ERROR.column_not_found, `column ${id} not found`)
    return c
  }

  /** number = id (must be in `board`); string = name (case-insensitive) within `board`. */
  function resolveColumn(board: BoardRow, ref: ColumnRef): ColumnRow {
    if (typeof ref === 'number') {
      const c = repo.getColumn(ref)
      if (!c || c.boardId !== board.id)
        throw new BoardError(BOARD_ERROR.invalid_target_column, `column ${ref} is not in board ${board.id}`)
      return c
    }
    const key = columnMergeKey(ref)
    const c = repo.listColumns(board.id).find((col) => columnMergeKey(col.name) === key)
    if (!c) throw new BoardError(BOARD_ERROR.column_not_found, `no column "${ref}"`)
    return c
  }

  /** Sort-key bounds of a position; ids that no longer exist are ignored, `afterTaskId` wins. */
  function taskBounds(position: TaskPosition | undefined): { afterKey?: string; beforeKey?: string } {
    const after = position?.afterTaskId !== undefined ? repo.getTask(position.afterTaskId) : undefined
    if (after) return { afterKey: after.sortOrder }
    const before = position?.beforeTaskId !== undefined ? repo.getTask(position.beforeTaskId) : undefined
    return before ? { beforeKey: before.sortOrder } : {}
  }

  async function taskDtos(rows: TaskRow[]): Promise<TaskDto[]> {
    const links = repo.listSessionLinks(rows.map((r) => r.id))
    const byTask = new Map<number, string[]>()
    for (const l of links) byTask.set(l.taskId, [...(byTask.get(l.taskId) ?? []), l.agentSessionId])
    const described = await sessions.describe(links.map((l) => l.agentSessionId))
    const known = new Map(described.map((s) => [s.sessionId, s]))
    const boards = new Map<number, BoardRow>()
    const boardOf = (id: number): BoardRow => {
      const cached = boards.get(id)
      if (cached) return cached
      const board = requireBoard(id)
      boards.set(id, board)
      return board
    }
    return rows.map((r) => toTaskDto(r, boardOf(r.boardId), byTask.get(r.id) ?? [], known))
  }

  async function taskDto(row: TaskRow): Promise<TaskDto> {
    const [dto] = await taskDtos([row])
    if (!dto) throw notFound(`task ${row.id}`)
    return dto
  }

  function section(board: BoardRow, projectName: string): BoardSection {
    return {
      board: toBoardDto(board),
      projectName,
      columns: repo.listColumns(board.id).map(toColumnDto),
      labels: repo.listLabels(board.id).map(toLabelDto),
    }
  }

  function findTaskRow(ref: TaskRef): TaskRow | undefined {
    if (typeof ref === 'number') return repo.getTask(ref)
    const text = ref.trim()
    if (DIGITS_RE.test(text)) return repo.getTask(Number(text))
    const m = TASK_KEY_RE.exec(text)?.groups
    if (!m) return undefined
    const prefix = String(m.prefix).toUpperCase()
    const board = repo.listBoards().find((b) => b.keyPrefix.toUpperCase() === prefix)
    return board ? repo.getTaskByKey(board.id, Number(m.number)) : undefined
  }

  return {
    ...deps,
    async ensureBoard(projectId: string): Promise<BoardRow> {
      return repo.findBoardByProject(projectId) ?? createBoard(await requireProject(projectId))
    },
    requireProject,
    requireBoard,
    requireTask,
    requireColumn,
    resolveColumn,
    taskBounds,
    taskDtos,
    taskDto,
    section,
    findTaskRow,
    /** One `board.changed` per committed mutation. */
    changed(board: BoardRow, taskIds: number[], kind: BoardChangedPayload['kind'] = CHANGE_KIND.task): void {
      deps.emit({ projectId: board.projectId ?? '', taskIds, kind })
    },
  }
}

export type BoardCore = ReturnType<typeof createBoardCore>
