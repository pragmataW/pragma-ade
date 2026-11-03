/** Pure selectors of the Tasks panel: the task tree of a transcript, its groups, counts, filters and details. */
import { TASK_PROMPT_FIELD } from '../../../constants'
import {
  type CHAT_TASK_STATUSES,
  type ChatTranscript,
  EVENT_KIND,
  itemKey,
  TASK_KIND,
  TASK_STATUS,
  type TaskItem,
  type ToolCallItem,
} from '../../../contract'
import { isLiveTask } from '../parts/lib/task-visual'

type TaskStatus = (typeof CHAT_TASK_STATUSES)[number]

export const TASK_GROUPS = ['running', 'waiting', 'finished'] as const
export type TaskGroup = (typeof TASK_GROUPS)[number]
export const TASK_GROUP = { running: 'running', waiting: 'waiting', finished: 'finished' } as const

export const TASK_FILTERS = ['all', 'running', 'subagents', 'workflows'] as const
export type TaskFilter = (typeof TASK_FILTERS)[number]
export const TASK_FILTER = { all: 'all', running: 'running', subagents: 'subagents', workflows: 'workflows' } as const

const GROUP_OF: Record<TaskStatus, TaskGroup> = {
  [TASK_STATUS.running]: TASK_GROUP.running,
  [TASK_STATUS.pending]: TASK_GROUP.waiting,
  [TASK_STATUS.paused]: TASK_GROUP.waiting,
  [TASK_STATUS.completed]: TASK_GROUP.finished,
  [TASK_STATUS.failed]: TASK_GROUP.finished,
  [TASK_STATUS.killed]: TASK_GROUP.finished,
}

/** Running · Waiting (pending, paused) · Finished (completed, failed, stopped). */
export const taskGroupOf = (status: TaskStatus): TaskGroup => GROUP_OF[status]

export interface TaskNode {
  task: TaskItem
  children: TaskNode[]
}

export const listTasks = (t: ChatTranscript): TaskItem[] =>
  t.items.filter((i): i is TaskItem => i.kind === EVENT_KIND.task)

export const findTask = (t: ChatTranscript, id: string): TaskItem | undefined => listTasks(t).find((x) => x.id === id)

function toolCallOf(t: ChatTranscript, id: string | undefined): ToolCallItem | undefined {
  if (!id) return undefined
  const pos = t.positions[itemKey(EVENT_KIND.toolCall, id)]
  const item = pos === undefined ? undefined : t.items[pos]
  return item?.kind === EVENT_KIND.toolCall ? item : undefined
}

/**
 * The parent task of each task: its `parentId` (a task id or the parent's tool call id), else the parent of the tool
 * call that spawned it (a subagent started from inside another subagent).
 */
function parentsOf(t: ChatTranscript, tasks: readonly TaskItem[]): Map<string, string> {
  const owner = new Map<string, string>()
  for (const task of tasks) {
    owner.set(task.id, task.id)
    if (task.toolCallId) owner.set(task.toolCallId, task.id)
  }
  const parents = new Map<string, string>()
  for (const task of tasks) {
    const ref = task.parentId ?? toolCallOf(t, task.toolCallId)?.parentId
    const parent = ref ? owner.get(ref) : undefined
    if (parent && parent !== task.id) parents.set(task.id, parent)
  }
  return parents
}

/** The task tree; roots and children in arrival order (a parent cycle leaves its tasks as roots). */
export function taskForest(t: ChatTranscript): TaskNode[] {
  const tasks = listTasks(t)
  const parents = parentsOf(t, tasks)
  const nodes = new Map(tasks.map((task) => [task.id, { task, children: [] as TaskNode[] }]))
  const roots: TaskNode[] = []
  for (const task of tasks) {
    const node = nodes.get(task.id) as TaskNode
    const parent = reachesRoot(task.id, parents) ? nodes.get(parents.get(task.id) ?? '') : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  return roots
}

function reachesRoot(id: string, parents: Map<string, string>): boolean {
  const seen = new Set<string>()
  for (let at: string | undefined = id; at; at = parents.get(at)) {
    if (seen.has(at)) return false
    seen.add(at)
  }
  return true
}

export interface TaskCounts {
  total: number
  running: number
  waiting: number
  /** Completed or stopped. */
  done: number
  failed: number
  workflows: number
}

type CountKey = 'running' | 'waiting' | 'done' | 'failed'
const COUNT_KEY_OF: Record<TaskStatus, CountKey> = {
  [TASK_STATUS.running]: TASK_GROUP.running,
  [TASK_STATUS.pending]: TASK_GROUP.waiting,
  [TASK_STATUS.paused]: TASK_GROUP.waiting,
  [TASK_STATUS.completed]: 'done',
  [TASK_STATUS.killed]: 'done',
  [TASK_STATUS.failed]: TASK_STATUS.failed,
}
const countKeyOf = (status: TaskStatus): CountKey => COUNT_KEY_OF[status]

export function taskCounts(t: ChatTranscript): TaskCounts {
  const counts: TaskCounts = { total: 0, running: 0, waiting: 0, done: 0, failed: 0, workflows: 0 }
  for (const task of listTasks(t)) {
    counts.total++
    if (task.taskKind === TASK_KIND.workflow) counts.workflows++
    counts[countKeyOf(task.status)]++
  }
  return counts
}

export interface TaskRow {
  task: TaskItem
  depth: number
  /** Shown only because a descendant matches the filter (dimmed). */
  context: boolean
}
export interface TaskSection {
  group: TaskGroup
  rows: TaskRow[]
}

const FILTERS: Record<TaskFilter, (task: TaskItem) => boolean> = {
  [TASK_FILTER.all]: () => true,
  [TASK_FILTER.running]: (task) => isLiveTask(task.status),
  [TASK_FILTER.subagents]: (task) => task.taskKind === TASK_KIND.subagent,
  [TASK_FILTER.workflows]: (task) => task.taskKind === TASK_KIND.workflow,
}

function matcher(filter: TaskFilter, query: string): (task: TaskItem) => boolean {
  const q = query.trim().toLowerCase()
  const byText = (task: TaskItem) => !q || `${task.name}\n${task.description ?? ''}`.toLowerCase().includes(q)
  return (task) => FILTERS[filter](task) && byText(task)
}

/** Depth-first rows of the nodes that match or have a matching descendant. */
function rowsOf(node: TaskNode, depth: number, matches: (task: TaskItem) => boolean): TaskRow[] {
  const below = node.children.flatMap((c) => rowsOf(c, depth + 1, matches))
  const self = matches(node.task)
  if (!self && below.length === 0) return []
  return [{ task: node.task, depth, context: !self }, ...below]
}

/** Trees grouped by their root's status (children stay with their root), empty groups left out. */
export function taskSections(forest: readonly TaskNode[], filter: TaskFilter, query: string): TaskSection[] {
  const matches = matcher(filter, query)
  return TASK_GROUPS.map((group) => ({
    group,
    rows: forest.filter((n) => taskGroupOf(n.task.status) === group).flatMap((n) => rowsOf(n, 0, matches)),
  })).filter((s) => s.rows.length > 0)
}

/** Ids from the root task down to `taskId` (empty when it is unknown). */
export function taskPath(t: ChatTranscript, taskId: string): string[] {
  const find = (nodes: readonly TaskNode[]): string[] => {
    for (const n of nodes) {
      if (n.task.id === taskId) return [n.task.id]
      const below = find(n.children)
      if (below.length > 0) return [n.task.id, ...below]
    }
    return []
  }
  return find(taskForest(t))
}

/** The prompt the spawning tool call sent (Task / Agent input). */
export function taskPrompt(t: ChatTranscript, task: TaskItem): string | undefined {
  const input = toolCallOf(t, task.toolCallId)?.input
  const prompt = typeof input === 'object' && input ? (input as Record<string, unknown>)[TASK_PROMPT_FIELD] : undefined
  return typeof prompt === 'string' && prompt ? prompt : undefined
}

/** The final output the spawning tool call returned (the subagent's report). */
export const taskResult = (t: ChatTranscript, task: TaskItem): string | undefined =>
  toolCallOf(t, task.toolCallId)?.output || undefined

/**
 * How long the task ran: live tasks tick from their start; finished ones use the provider's duration, else start →
 * end (unknown when both are the same instant, e.g. replayed history).
 */
export function taskElapsedMs(task: TaskItem, now: number): number | undefined {
  if (isLiveTask(task.status)) return Math.max(0, now - task.startedAt)
  if (task.usage?.durationMs) return task.usage.durationMs
  const span = (task.endedAt ?? task.startedAt) - task.startedAt
  return span > 0 ? span : undefined
}
