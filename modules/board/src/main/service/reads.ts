import {
  type BoardScope,
  type BoardSection,
  type BoardSnapshot,
  type ColumnId,
  type LabelId,
  SCOPE_KIND,
  type TaskDto,
  type TaskFilter,
  TaskFilterSchema,
  type TaskRef,
} from '../../contract'
import { matchesTaskPredicate, type TaskPredicate } from '../../lib/filter'
import { columnMergeKey } from '../../lib/merge-columns'
import type { BoardRow } from '../schema'
import type { BoardCore } from './core'

interface ScopedBoard {
  board: BoardRow
  projectName: string
}

/** Read side: boards, snapshots and filtered task lists (boards of projects no longer listed are hidden). */
export function createReads(core: BoardCore) {
  const { repo, projects } = core

  async function scopedBoards(scope: BoardScope): Promise<ScopedBoard[]> {
    if (scope.kind === SCOPE_KIND.project) {
      const project = await core.requireProject(scope.projectId)
      return [{ board: await core.ensureBoard(project.id), projectName: project.name }]
    }
    const listed = await projects.listProjects()
    const out: ScopedBoard[] = []
    for (const p of listed) out.push({ board: await core.ensureBoard(p.id), projectName: p.name })
    return out
  }

  /** Existing boards the filter can see, in project order (never creates one). */
  async function filterBoards(filter: TaskFilter): Promise<BoardRow[]> {
    if (filter.projectId !== undefined) {
      const b = repo.findBoardByProject(filter.projectId)
      return b ? [b] : []
    }
    const listed = await projects.listProjects()
    return listed.flatMap((p) => repo.findBoardByProject(p.id) ?? [])
  }

  function columnIds(boards: BoardRow[], ref: TaskFilter['column']): ColumnId[] | undefined {
    if (ref === undefined) return undefined
    const columns = boards.flatMap((b) => repo.listColumns(b.id))
    if (typeof ref === 'number') return columns.filter((c) => c.id === ref).map((c) => c.id)
    return columns.filter((c) => columnMergeKey(c.name) === columnMergeKey(ref)).map((c) => c.id)
  }

  function labelIds(boards: BoardRow[], refs: TaskFilter['labels']): LabelId[] | undefined {
    if (!refs || refs.length === 0) return undefined
    const labels = boards.flatMap((b) => repo.listLabels(b.id))
    return labels
      .filter((l) =>
        refs.some((r) => (typeof r === 'number' ? r === l.id : columnMergeKey(r) === columnMergeKey(l.name))),
      )
      .map((l) => l.id)
  }

  async function listTasks(raw: TaskFilter = {}): Promise<TaskDto[]> {
    const filter = TaskFilterSchema.parse(raw)
    const boards = await filterBoards(filter)
    const p: TaskPredicate = {
      columnIds: columnIds(boards, filter.column),
      labelIds: labelIds(boards, filter.labels),
      worktreeId: filter.worktreeId,
      sessionId: filter.sessionId,
      priorities: filter.priorities,
      hasWorktree: filter.hasWorktree,
      query: filter.query,
    }
    // A column or label that resolves to nothing matches no task (an empty list would mean "no constraint").
    if (p.columnIds?.length === 0 || p.labelIds?.length === 0) return []
    const rows = boards.flatMap((b) => repo.listTasks({ boardIds: [b.id] }))
    return (await core.taskDtos(rows)).filter((t) => matchesTaskPredicate(t, p))
  }

  return {
    listTasks,
    async getBoard(projectId: string): Promise<BoardSection> {
      const project = await core.requireProject(projectId)
      return core.section(await core.ensureBoard(project.id), project.name)
    },
    async getSnapshot(scope: BoardScope): Promise<BoardSnapshot> {
      const scoped = await scopedBoards(scope)
      const rows = scoped.flatMap((s) => repo.listTasks({ boardIds: [s.board.id] }))
      return {
        scope,
        sections: scoped.map((s) => core.section(s.board, s.projectName)),
        tasks: await core.taskDtos(rows),
        statusAvailable: core.sessions.statusAvailable,
      }
    },
    async getTask(ref: TaskRef): Promise<TaskDto | null> {
      const row = core.findTaskRow(ref)
      return row ? core.taskDto(row) : null
    },
  }
}
