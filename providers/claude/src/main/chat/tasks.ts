import { type ChatEvent, type ChatEventOf, EVENT_KIND as K, TASK_KIND, TASK_STATUS } from '@pragma/module-chat/contract'
import { NOTIFICATION_STATUS, SYSTEM_SUBTYPE, TASK_TYPE, TASK_TYPE_NAMES } from './constants'
import { list, num, type Obj, obj, str } from './frame-fields'

type TaskEvent = ChatEventOf<typeof K.task>
type TaskKind = TaskEvent['taskKind']
type TaskStatus = TaskEvent['status']

interface KnownTask {
  /** Foreground shell jobs stay hidden (their tool call shows them) until they move to the background. */
  shown: boolean
  kind: TaskKind
  base: Pick<TaskEvent, 'taskId' | 'name'> &
    Partial<Pick<TaskEvent, 'toolCallId' | 'description' | 'depth' | 'parentId'>>
}

const TASK_STATUSES = new Set<string>(Object.values(TASK_STATUS))
const asStatus = (v: unknown): TaskStatus | undefined => {
  const s = str(v)
  return s && TASK_STATUSES.has(s) ? (s as TaskStatus) : undefined
}

/** `local_workflow` → workflow; backgrounded or non-agent jobs → background; subagents otherwise. */
function kindOf(type: string, backgrounded: boolean): TaskKind {
  if (type === TASK_TYPE.workflow) return TASK_KIND.workflow
  return backgrounded || type !== TASK_TYPE.agent ? TASK_KIND.background : TASK_KIND.subagent
}

const usageOf = (u: unknown): TaskEvent['usage'] | undefined => {
  const o = obj(u)
  if (Object.keys(o).length === 0) return undefined
  return { tokens: num(o.total_tokens), toolUses: num(o.tool_uses), durationMs: num(o.duration_ms) }
}

const defined = <T extends Obj>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T

export interface TaskMapper {
  /** `system/task_*` and `background_tasks_changed` frames → `task` events (ambient/skip_transcript tasks hidden). */
  map(frame: Obj): ChatEvent[] | undefined
}

/** Stateful SDK task frames → upserted `task` events. */
export function createTaskMapper(): TaskMapper {
  const known = new Map<string, KnownTask>()
  const hidden = new Set<string>()

  const event = (t: KnownTask, status: TaskStatus | undefined, extra: Obj = {}): TaskEvent =>
    defined({ kind: K.task, ...t.base, taskKind: t.kind, ...(status ? { status } : {}), ...extra }) as TaskEvent

  function baseOf(f: Obj, taskId: string, type: string): KnownTask['base'] {
    const parent = str(f.parent_task_id)
    return {
      taskId,
      name: str(f.workflow_name) ?? str(f.subagent_type) ?? TASK_TYPE_NAMES[type] ?? type,
      toolCallId: str(f.tool_use_id),
      description: str(f.description),
      depth: typeof f.spawn_depth === 'number' ? f.spawn_depth : undefined,
      parentId: parent && known.has(parent) ? parent : undefined,
    }
  }

  function register(f: Obj, backgrounded: boolean): KnownTask | undefined {
    const taskId = str(f.task_id) ?? ''
    if (f.ambient === true || f.skip_transcript === true) hidden.add(taskId)
    if (!taskId || hidden.has(taskId)) return undefined
    const type = str(f.task_type) ?? TASK_TYPE.agent
    const t: KnownTask = {
      shown: backgrounded || type === TASK_TYPE.agent || type === TASK_TYPE.workflow,
      kind: kindOf(type, backgrounded),
      base: baseOf(f, taskId, type),
    }
    known.set(taskId, t)
    return t
  }

  function started(f: Obj): ChatEvent[] {
    const backgrounded = f.is_backgrounded === true
    const t = register(f, backgrounded)
    return t?.shown ? [event(t, TASK_STATUS.running)] : []
  }

  function updated(f: Obj): ChatEvent[] {
    const t = known.get(str(f.task_id) ?? '')
    if (!t) return []
    const patch = obj(f.patch)
    const backgrounded = patch.is_backgrounded === true
    if (backgrounded) {
      t.shown = true
      if (t.kind === TASK_KIND.subagent) t.kind = TASK_KIND.background
    }
    if (!t.shown) return []
    return [event(t, asStatus(patch.status), { summary: str(patch.error) })]
  }

  function progress(f: Obj): ChatEvent[] {
    const t = known.get(str(f.task_id) ?? '')
    if (!t?.shown) return []
    const extra = {
      summary: str(f.summary) ?? str(f.description),
      lastTool: str(f.last_tool_name),
      usage: usageOf(f.usage),
    }
    return [event(t, TASK_STATUS.running, extra)]
  }

  function notification(f: Obj): ChatEvent[] {
    const t = known.get(str(f.task_id) ?? '')
    if (!t?.shown) return []
    const status = NOTIFICATION_STATUS[str(f.status) as keyof typeof NOTIFICATION_STATUS] ?? TASK_STATUS.completed
    return [event(t, status, { summary: str(f.summary), usage: usageOf(f.usage) })]
  }

  /** REPLACE semantics: only tasks this mapper never saw start are added (e.g. after a resume). */
  function background(f: Obj): ChatEvent[] {
    return list(f.tasks).flatMap((task) =>
      known.has(str(task.task_id) ?? '') ? [] : started({ ...task, is_backgrounded: true }),
    )
  }

  const HANDLERS: Record<string, (f: Obj) => ChatEvent[]> = {
    [SYSTEM_SUBTYPE.taskStarted]: started,
    [SYSTEM_SUBTYPE.taskUpdated]: updated,
    [SYSTEM_SUBTYPE.taskProgress]: progress,
    [SYSTEM_SUBTYPE.taskNotification]: notification,
    [SYSTEM_SUBTYPE.backgroundTasksChanged]: background,
  }

  return { map: (frame) => HANDLERS[str(frame.subtype) ?? '']?.(frame) }
}
