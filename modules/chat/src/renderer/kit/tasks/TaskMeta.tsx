import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { ICON_STROKE } from '../../../constants'
import type { TaskItem } from '../../../contract'
import { formatTokens, formatUsd } from '../parts/lib/format'
import { isLiveTask, TASK_ICONS, TASK_TONE } from '../parts/lib/task-visual'
import { TONE_TEXT } from '../parts/lib/tone'
import { formatElapsed } from '../parts/WorkingLine'
import { taskElapsedMs } from './model'

/** The kind icon in the colour of the task's status (running blue, done green, failed red…). */
export function TaskKindIcon({ task, size, className }: { task: TaskItem; size: number; className?: string }) {
  const Icon = TASK_ICONS[task.taskKind]
  return (
    <Icon
      size={size}
      strokeWidth={ICON_STROKE}
      aria-hidden
      className={cn('shrink-0', TONE_TEXT[TASK_TONE[task.status]], className)}
    />
  )
}

/** "1m 05s · 18.4K tokens · $0.05 · 7 tool uses · Last: Grep" (what the task reported so far). */
export function useTaskMetaParts(
  task: TaskItem,
  now: number | null,
  opts: { lastTool: boolean; toolUses?: boolean },
): string[] {
  const t = useT()
  const elapsed = now === null ? undefined : taskElapsedMs(task, now)
  const { usage } = task
  return [
    elapsed === undefined ? undefined : formatElapsed(elapsed),
    usage ? t('chat:task.tokens', { tokens: formatTokens(usage.tokens) }) : undefined,
    usage?.costUsd === undefined ? undefined : formatUsd(usage.costUsd),
    usage?.toolUses && opts.toolUses !== false ? t('chat:tasks.toolUses', { count: usage.toolUses }) : undefined,
    opts.lastTool && task.lastTool && isLiveTask(task.status)
      ? t('chat:task.lastTool', { tool: task.lastTool })
      : undefined,
  ].filter((p): p is string => Boolean(p))
}
