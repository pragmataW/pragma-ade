import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { ChevronRight, LoaderCircle, PanelRightOpen, Square } from '@pragma/ui/icons'
import { useCallback, useRef, useState } from 'react'
import {
  BUTTON_TYPE,
  ICON_PX,
  ICON_STROKE,
  META_SEPARATOR,
  SIZE_ICON_XS,
  SMALL_ICON_PX,
  VARIANT_GHOST,
} from '../../../constants'
import {
  CHAT_DATA_ATTRS,
  CHAT_TESTIDS,
  type ChatPartProps,
  type ChatSessionApi,
  EVENT_KIND,
  hasAction,
  SESSION_ACTION,
  TASK_KIND,
  TASK_STATUS,
  type TaskItem,
} from '../../../contract'
import { useTasksPanelMounted, useTasksPanelStore } from '../tasks/store'
import { useTaskMetaParts } from '../tasks/TaskMeta'
import { useTaskReveal } from '../tasks/use-task-reveal'
import { ChildTranscript } from './ChatRows'
import { isLiveTask, TASK_ICONS, TASK_TONE } from './lib/task-visual'
import { PILL, TONE_BADGE } from './lib/tone'

/** "Running" pill in the task's tone (spinning ring while it runs). */
export function TaskStatusPill({ item }: { item: TaskItem }) {
  const t = useT()
  return (
    <span className={cn(PILL, TONE_BADGE[TASK_TONE[item.status]])}>
      {item.status === TASK_STATUS.running ? (
        <LoaderCircle
          size={SMALL_ICON_PX}
          strokeWidth={ICON_STROKE}
          aria-hidden
          className="animate-spin motion-reduce:animate-none"
        />
      ) : null}
      {t(`chat:task.status.${item.status}`)}
    </span>
  )
}

/** Stops a live task when the session offers `stopTask`. */
export function TaskStopButton({ item, session }: { item: TaskItem; session: ChatSessionApi }) {
  const t = useT()
  if (!isLiveTask(item.status) || !hasAction(session.transcript.info, SESSION_ACTION.stopTask)) return null
  return (
    <Button
      variant={VARIANT_GHOST}
      size={SIZE_ICON_XS}
      data-testid={CHAT_TESTIDS.taskStop}
      aria-label={t('chat:task.stop', { name: item.name })}
      title={t('chat:task.stop', { name: item.name })}
      onClick={() => void session.action({ action: SESSION_ACTION.stopTask, taskId: item.id })}
      className="size-6 text-mu hover:text-err"
    >
      <Square size={SMALL_ICON_PX} strokeWidth={ICON_STROKE} className="fill-current" />
    </Button>
  )
}

/** Opens the task in the chat's Tasks panel (only when the provider's chat UI has one). */
export function TaskOpenInPanel({ item, session }: { item: TaskItem; session: ChatSessionApi }) {
  const t = useT()
  if (!useTasksPanelMounted(session.sessionId)) return null
  return (
    <Button
      variant={VARIANT_GHOST}
      size={SIZE_ICON_XS}
      data-testid={CHAT_TESTIDS.taskOpenInPanel}
      aria-label={t('chat:tasks.openInPanel', { name: item.name })}
      title={t('chat:tasks.openInPanel', { name: item.name })}
      onClick={() => useTasksPanelStore.getState().openTask(session.sessionId, item.id)}
      className="size-6 text-mu hover:text-act"
    >
      <PanelRightOpen size={SMALL_ICON_PX} strokeWidth={ICON_STROKE} />
    </Button>
  )
}

/** "12.3K tokens · $0.02 · Last: Grep" */
function TaskMeta({ item }: { item: TaskItem }) {
  const parts = useTaskMetaParts(item, null, { lastTool: true, toolUses: false })
  if (parts.length === 0) return null
  return (
    <span className="min-w-0 max-w-[45%] shrink truncate text-[11.5px] tabular-nums text-mu">
      {parts.join(META_SEPARATOR)}
    </span>
  )
}

/**
 * A subagent, workflow run or background job: kind icon, name, description, live status pill, last tool and usage;
 * expanding shows its own transcript (nested parts, tasks included). Collapsed by default.
 */
export function TaskCard({ item, session }: ChatPartProps<TaskItem>) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const flashing = useTaskReveal(
    session.sessionId,
    item.id,
    root,
    useCallback(() => setOpen(true), []),
  )
  const Icon = TASK_ICONS[item.taskKind]
  const workflow = item.taskKind === TASK_KIND.workflow
  return (
    <div
      ref={root}
      data-testid={CHAT_TESTIDS.part(EVENT_KIND.task)}
      data-open={open}
      data-flash={flashing || undefined}
      {...{ [CHAT_DATA_ATTRS.status]: item.status, [CHAT_DATA_ATTRS.itemId]: item.id }}
      className={cn(
        'rounded-lg border border-bd bg-el transition-[box-shadow,background-color] duration-700 ease-out',
        workflow && 'border-l-2 border-l-act',
        flashing && 'bg-acs ring-2 ring-act/70 duration-150',
      )}
    >
      <div className="flex h-8 min-w-0 items-center gap-2 pr-1.5">
        <button
          type={BUTTON_TYPE}
          aria-expanded={open}
          data-testid={CHAT_TESTIDS.taskToggle}
          onClick={() => setOpen((o) => !o)}
          className="flex h-full min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-l-lg pl-2.5 text-left text-[12.5px] hover:bg-hv"
        >
          <ChevronRight
            size={ICON_PX}
            strokeWidth={ICON_STROKE}
            aria-hidden
            className={cn('shrink-0 text-mu transition-transform', open && 'rotate-90')}
          />
          <Icon size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
          <span className="shrink-0 font-semibold text-tx">{item.name}</span>
          {workflow ? <span className="shrink-0 text-[11px] text-mu">{t('chat:task.kind.workflow')}</span> : null}
          <span className="min-w-0 flex-1 truncate text-mu">{item.description ?? ''}</span>
        </button>
        <TaskMeta item={item} />
        <TaskStatusPill item={item} />
        <TaskOpenInPanel item={item} session={session} />
        <TaskStopButton item={item} session={session} />
      </div>
      {item.summary ? (
        <p className="border-t border-bd px-2.5 py-1.5 text-[12.5px] leading-[1.5] text-tx">{item.summary}</p>
      ) : null}
      {open ? (
        <div className="border-t border-bd py-2 pr-2.5 pl-4">
          <div className="border-l-2 border-bd pl-3">
            <ChildTranscript
              parentIds={[item.id, item.toolCallId]}
              session={session}
              testId={CHAT_TESTIDS.taskChildren}
            />
            <EmptyChildren item={item} session={session} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** "No output yet" when the provider sent nothing nested (yet). */
function EmptyChildren({ item, session }: { item: TaskItem; session: ChatSessionApi }) {
  const t = useT()
  const any = [item.id, item.toolCallId].some((p) => p && (session.transcript.children[p]?.length ?? 0) > 0)
  return any ? null : <span className="text-[12px] text-fa">{t('chat:task.empty')}</span>
}
