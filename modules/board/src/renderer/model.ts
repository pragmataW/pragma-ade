import { keyedEnum } from '@pragma/module-agents/contract'
import { z } from '@pragma/sdk'
import { NO_AGENT_FILTER_VALUE, WORKTREE_FILTERS } from '../constants'
import {
  type BoardSection,
  type BoardSnapshot,
  type ColumnDto,
  type ColumnId,
  type Id,
  PrioritySchema,
  type TaskDto,
  type TaskPosition,
} from '../contract'
import { matchesTaskPredicate, type TaskPredicate } from '../lib/filter'
import { columnMergeKey, type MergedColumn } from '../lib/merge-columns'
import { compareSortKeys } from '../lib/order'

export { openCount } from '../lib/snapshot'

export const WorktreeFilterSchema = z.enum(WORKTREE_FILTERS)
export type WorktreeFilter = z.infer<typeof WorktreeFilterSchema>
export const WORKTREE_FILTER = keyedEnum(WORKTREE_FILTERS)

export const UiFilterSchema = z.object({
  query: z.string(),
  labelNames: z.array(z.string()),
  priorities: z.array(PrioritySchema),
  /** Profile ids and/or `NO_AGENT_FILTER_VALUE`. */
  agents: z.array(z.string()),
  worktree: WorktreeFilterSchema,
})
export type UiFilter = z.infer<typeof UiFilterSchema>
export const EMPTY_FILTER: UiFilter = { query: '', labelNames: [], priorities: [], agents: [], worktree: 'any' }

export const isFilterActive = (f: UiFilter): boolean =>
  f.query.trim() !== '' ||
  f.labelNames.length > 0 ||
  f.priorities.length > 0 ||
  f.agents.length > 0 ||
  f.worktree !== WORKTREE_FILTER.any

const HAS_WORKTREE: Record<WorktreeFilter, boolean | undefined> = { any: undefined, with: true, without: false }

/** UI filter → predicate: label names resolve to every matching label id across sections. */
export function buildPredicate(f: UiFilter, sections: readonly BoardSection[]): TaskPredicate {
  const names = new Set(f.labelNames.map(columnMergeKey))
  const labelIds = sections.flatMap((s) => s.labels.filter((l) => names.has(columnMergeKey(l.name))).map((l) => l.id))
  return {
    query: f.query,
    labelIds,
    priorities: f.priorities,
    agentProfileIds: f.agents.filter((a) => a !== NO_AGENT_FILTER_VALUE),
    includeNoAgent: f.agents.includes(NO_AGENT_FILTER_VALUE),
    hasWorktree: HAS_WORKTREE[f.worktree],
  }
}

export interface AgentOption {
  profileId: Id
  profileName: string | null
  profileDisplayNameKey: string | null
}

/** Distinct profiles among linked sessions, sorted by name. */
export function agentFilterOptions(snapshot: Pick<BoardSnapshot, 'tasks'>): AgentOption[] {
  const byId = new Map<Id, AgentOption>()
  for (const s of snapshot.tasks.flatMap((t) => t.sessions))
    if (s.profileId && !byId.has(s.profileId))
      byId.set(s.profileId, {
        profileId: s.profileId,
        profileName: s.profileName,
        profileDisplayNameKey: s.profileDisplayNameKey,
      })
  const label = (o: AgentOption) => o.profileName ?? o.profileDisplayNameKey ?? o.profileId
  return [...byId.values()].sort((a, b) => label(a).localeCompare(label(b)))
}

export type BoardColumnModel = MergedColumn | ColumnDto
export const isMerged = (c: BoardColumnModel): c is MergedColumn => 'columnIdByBoard' in c
/** Map key of a column: merge key (All projects) or `String(id)` (one project). */
export const columnKeyOf = (c: BoardColumnModel): string => (isMerged(c) ? c.key : String(c.id))
const holds = (c: BoardColumnModel, t: TaskDto): boolean =>
  isMerged(c) ? c.columnIdByBoard[t.boardId] === t.columnId : c.id === t.columnId

/** Tasks per column (filtered, in sort-key order). */
export function groupTasks(
  snapshot: Pick<BoardSnapshot, 'tasks'>,
  columns: readonly BoardColumnModel[],
  p: TaskPredicate,
): Map<string, TaskDto[]> {
  const visible = snapshot.tasks.filter((t) => matchesTaskPredicate(t, p))
  return new Map(
    columns.map((c) => [
      columnKeyOf(c),
      visible.filter((t) => holds(c, t)).sort((a, b) => compareSortKeys(a.sortKey, b.sortKey)),
    ]),
  )
}

export type DropResult =
  | { ok: true; column: ColumnId; position: TaskPosition }
  | { ok: false; reason: 'no_such_column' }
const NO_SUCH_COLUMN = 'no_such_column'

/** Where a dropped card goes: between its visible neighbours (`visibleTasks` excludes the dragged card). */
export function resolveDrop(args: {
  task: TaskDto
  targetColumn: BoardColumnModel
  visibleTasks: readonly TaskDto[]
  index: number
}): DropResult {
  const { task, targetColumn, visibleTasks, index } = args
  const column = isMerged(targetColumn) ? targetColumn.columnIdByBoard[task.boardId] : targetColumn.id
  if (column === undefined) return { ok: false, reason: NO_SUCH_COLUMN }
  const after = visibleTasks[index - 1]
  if (after) return { ok: true, column, position: { afterTaskId: after.id } }
  const before = visibleTasks[index]
  return { ok: true, column, position: before ? { beforeTaskId: before.id } : {} }
}
