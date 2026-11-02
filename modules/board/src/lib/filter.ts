import { z } from '@pragma/sdk'
import { ColumnIdSchema, IdSchema, LabelIdSchema, PrioritySchema, type TaskDto } from '../contract'

/** Resolved filter (ids, not refs); empty arrays mean "no constraint". Shared by main and renderer. */
export const TaskPredicateSchema = z.object({
  columnIds: z.array(ColumnIdSchema).optional(),
  worktreeId: IdSchema.optional(),
  sessionId: IdSchema.optional(),
  /** Any-of. */
  labelIds: z.array(LabelIdSchema).optional(),
  priorities: z.array(PrioritySchema).optional(),
  hasWorktree: z.boolean().optional(),
  /** Case-insensitive substring of title, description or key. */
  query: z.string().optional(),
  /** Any linked session's profile is in the list … */
  agentProfileIds: z.array(IdSchema).optional(),
  /** … or (when set) the task has no linked session. */
  includeNoAgent: z.boolean().optional(),
})
export type TaskPredicate = z.infer<typeof TaskPredicateSchema>

const anyOf = <T>(wanted: readonly T[] | undefined, has: (v: T) => boolean): boolean =>
  !wanted || wanted.length === 0 || wanted.some(has)

function matchesQuery(task: TaskDto, query: string | undefined): boolean {
  const q = query?.trim().toLowerCase()
  if (!q) return true
  return [task.title, task.descriptionMd, task.key].some((s) => s.toLowerCase().includes(q))
}

function matchesAgent(task: TaskDto, p: TaskPredicate): boolean {
  const profiles = p.agentProfileIds ?? []
  if (profiles.length === 0 && !p.includeNoAgent) return true
  if (p.includeNoAgent && task.sessionIds.length === 0) return true
  return task.sessions.some((s) => s.profileId !== null && profiles.includes(s.profileId))
}

function matchesWorktree(task: TaskDto, p: TaskPredicate): boolean {
  if (p.worktreeId !== undefined && task.worktreeId !== p.worktreeId) return false
  return p.hasWorktree === undefined || (task.worktreeId !== null) === p.hasWorktree
}

export function matchesTaskPredicate(task: TaskDto, p: TaskPredicate): boolean {
  if (!anyOf(p.columnIds, (id) => id === task.columnId)) return false
  if (!anyOf(p.labelIds, (id) => task.labelIds.includes(id))) return false
  if (!anyOf(p.priorities, (pr) => pr === task.priority)) return false
  if (p.sessionId !== undefined && !task.sessionIds.includes(p.sessionId)) return false
  return matchesWorktree(task, p) && matchesQuery(task, p.query) && matchesAgent(task, p)
}
