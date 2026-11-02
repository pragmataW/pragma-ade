import { useT } from '@pragma/sdk/renderer'
import { ICON_PX, ICON_STROKE, TASK_INDENT_PX } from '../../../constants'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, type ChatSlotProps, EVENT_KIND, type TaskItem } from '../../../contract'
import { TASK_ICONS } from './lib/task-visual'
import { TaskStatusPill, TaskStopButton } from './TaskCard'

/** Side panel / header slot: every task of the session (nested by depth) with its live status and Stop. */
export function TaskTree({ session }: ChatSlotProps) {
  const t = useT()
  const tasks = session.transcript.items.filter((i): i is TaskItem => i.kind === EVENT_KIND.task)
  if (tasks.length === 0) return null
  return (
    <section data-testid={CHAT_TESTIDS.taskTree} aria-label={t('chat:task.tree')} className="flex flex-col gap-1">
      <h3 className="px-1 text-[11px] font-semibold tracking-[0.06em] text-mu uppercase">{t('chat:task.tree')}</h3>
      <ul className="flex flex-col">
        {tasks.map((task) => {
          const Icon = TASK_ICONS[task.taskKind]
          return (
            <li
              key={task.id}
              data-testid={CHAT_TESTIDS.taskTreeRow}
              {...{ [CHAT_DATA_ATTRS.status]: task.status, [CHAT_DATA_ATTRS.itemId]: task.id }}
              style={{ paddingLeft: (task.depth ?? 0) * TASK_INDENT_PX }}
              className="flex h-7 min-w-0 items-center gap-1.5 rounded-md px-1 text-[12px] hover:bg-hv"
            >
              <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
              <span className="shrink-0 font-semibold text-tx">{task.name}</span>
              <span className="min-w-0 flex-1 truncate text-mu">{task.description ?? ''}</span>
              <TaskStatusPill item={task} />
              <TaskStopButton item={task} session={session} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
