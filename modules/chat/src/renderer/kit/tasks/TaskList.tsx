import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { ListTree, SearchX } from '@pragma/ui/icons'
import { BUTTON_TYPE, ICON_PX, ICON_STROKE, LARGE_ICON_PX, META_SEPARATOR, TASK_INDENT_PX } from '../../../constants'
import { CHAT_DATA_ATTRS, CHAT_TESTIDS, TASK_KIND } from '../../../contract'
import { SECTION_LABEL } from '../parts/lib/tone'
import { useNow } from '../parts/lib/use-now'
import { TaskStatusPill } from '../parts/TaskCard'
import { TASK_GROUP, type TaskRow, type TaskSection, taskGroupOf } from './model'
import { TaskKindIcon, useTaskMetaParts } from './TaskMeta'

/** Tree guides: one hairline per ancestor level, so nested subagents read as a tree. */
function Guides({ depth }: { depth: number }) {
  if (depth === 0) return null
  return (
    <span aria-hidden className="flex shrink-0 self-stretch" style={{ width: depth * TASK_INDENT_PX }}>
      {Array.from({ length: depth }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one guide per level
        <span key={i} className="h-full border-l border-bd" style={{ width: TASK_INDENT_PX }} />
      ))}
    </span>
  )
}

function Row({ row, now, onSelect }: { row: TaskRow; now: number; onSelect(): void }) {
  const t = useT()
  const { task, depth, context } = row
  const meta = useTaskMetaParts(task, now, { lastTool: true })
  return (
    <li>
      <button
        type={BUTTON_TYPE}
        data-testid={CHAT_TESTIDS.tasksRow}
        {...{ [CHAT_DATA_ATTRS.status]: task.status, [CHAT_DATA_ATTRS.itemId]: task.id }}
        data-depth={depth}
        onClick={onSelect}
        className={cn(
          'group flex w-full min-w-0 items-stretch gap-2 rounded-md px-2 text-left hover:bg-hv',
          context && 'opacity-60',
        )}
      >
        <Guides depth={depth} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-1.5">
          <span className="flex min-w-0 items-center gap-1.5 text-[12.5px]">
            <TaskKindIcon task={task} size={ICON_PX} />
            <span className="shrink-0 font-semibold text-tx">{task.name}</span>
            {task.taskKind === TASK_KIND.workflow ? (
              <span className="shrink-0 text-[11px] text-act">{t('chat:task.kind.workflow')}</span>
            ) : null}
            <span className="min-w-0 flex-1 truncate text-mu">{task.description ?? ''}</span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-[11px] tabular-nums text-fa">
            <TaskStatusPill item={task} />
            <span className="min-w-0 truncate">{meta.join(META_SEPARATOR)}</span>
          </span>
        </span>
      </button>
    </li>
  )
}

/** Running / Waiting / Finished sections; a row opens the task's detail view. */
export function TaskList({ sections, onSelect }: { sections: TaskSection[]; onSelect(taskId: string): void }) {
  const t = useT()
  const now = useNow(sections.some((s) => s.group !== TASK_GROUP.finished))
  return (
    <div className="flex flex-col gap-3 px-2 py-2">
      {sections.map((s) => (
        <section
          key={s.group}
          data-testid={CHAT_TESTIDS.tasksSection(s.group)}
          aria-label={t(`chat:tasks.group.${s.group}`)}
        >
          <h3 className={cn(SECTION_LABEL, 'flex h-6 items-center gap-1.5 px-2')}>
            {t(`chat:tasks.group.${s.group}`)}
            <span className="rounded-sm bg-hv px-1 text-[10.5px] tabular-nums tracking-normal text-mu">
              {s.rows.filter((r) => !r.context && taskGroupOf(r.task.status) === s.group).length}
            </span>
          </h3>
          <ul className="flex flex-col">
            {s.rows.map((row) => (
              <Row key={row.task.id} row={row} now={now} onSelect={() => onSelect(row.task.id)} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** No tasks at all (with a hint), or none matching the filter. */
export function TaskListEmpty({ filtered }: { filtered: boolean }) {
  const t = useT()
  const Icon = filtered ? SearchX : ListTree
  return (
    <div data-testid={CHAT_TESTIDS.tasksEmpty} className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="flex size-9 items-center justify-center rounded-full border border-bd bg-el text-mu">
        <Icon size={LARGE_ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
      </span>
      <p className="text-[12.5px] font-semibold text-tx">
        {t(filtered ? 'chat:tasks.noMatch' : 'chat:tasks.empty.title')}
      </p>
      {filtered ? null : (
        <p className="max-w-[240px] text-[12px] leading-[1.5] text-mu">{t('chat:tasks.empty.hint')}</p>
      )}
    </div>
  )
}
