import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { CopyButton } from '@pragma/ui/components/copy-button'
import { ArrowDown, ArrowLeft, ChevronRight, LocateFixed } from '@pragma/ui/icons'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  BUTTON_TYPE,
  ICON_PX,
  ICON_STROKE,
  LARGE_ICON_PX,
  META_SEPARATOR,
  SIZE_ICON_XS,
  SIZE_SM,
  TASK_PROMPT_CLAMP_CHARS,
  VARIANT_GHOST,
  VARIANT_OUTLINE,
} from '../../../constants'
import {
  CHAT_TESTIDS,
  type ChatSessionApi,
  type ChatTranscript,
  childItems,
  EVENT_KIND,
  type TaskItem,
} from '../../../contract'
import { useChatHost } from '../../host-adapter'
import { ChildTranscript } from '../parts/ChatRows'
import { isLiveTask } from '../parts/lib/task-visual'
import { SECTION_LABEL } from '../parts/lib/tone'
import { useNow } from '../parts/lib/use-now'
import { useStickToBottom } from '../parts/lib/useStickToBottom'
import { RichMarkdown } from '../parts/markdown/RichMarkdown'
import { TaskStatusPill, TaskStopButton } from '../parts/TaskCard'
import { type TaskNode, taskPrompt, taskResult } from './model'
import { TaskKindIcon, useTaskMetaParts } from './TaskMeta'

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-1.5">
      <h4 className={SECTION_LABEL}>{title}</h4>
      {children}
    </section>
  )
}

/** A finished task's result as rich Markdown (links open externally). */
function TaskResultText({ text }: { text: string }) {
  const host = useChatHost()
  return (
    <div className="text-[12.5px] leading-[1.55] text-tx">
      <RichMarkdown text={text} onLinkClick={(href) => host.openExternal(href)} />
    </div>
  )
}

/** The prompt, clamped to a few lines with "Show more". */
function Prompt({ text }: { text: string }) {
  const t = useT()
  const long = text.length > TASK_PROMPT_CLAMP_CHARS
  const [full, setFull] = useState(false)
  return (
    <div className="rounded-md border border-bd bg-bg px-2.5 py-2 text-[12px] leading-[1.55] text-tx">
      <p className={full || !long ? 'whitespace-pre-wrap break-words' : 'line-clamp-4 whitespace-pre-wrap break-words'}>
        {text}
      </p>
      {long ? (
        <button
          type={BUTTON_TYPE}
          onClick={() => setFull((f) => !f)}
          className="mt-1 text-[11.5px] text-act hover:underline"
        >
          {t(full ? 'chat:tasks.showLess' : 'chat:tasks.showMore')}
        </button>
      ) : null}
    </div>
  )
}

/** Plain text of everything the task wrote (copy when it has no final output yet). */
function childText(t: ChatTranscript, task: TaskItem): string {
  return childItems(t, [task.id, task.toolCallId])
    .flatMap((i) => (i.kind === EVENT_KIND.textDelta ? [i.text] : []))
    .join('\n\n')
}

/** The task's live transcript: sticks to the newest output, "Jump to latest" when scrolled up. */
function Activity({ task, session }: { task: TaskItem; session: ChatSessionApi }) {
  const t = useT()
  const scroller = useRef<HTMLDivElement>(null)
  const { atBottom, onScroll } = useStickToBottom(scroller)
  const items = childItems(session.transcript, [task.id, task.toolCallId])
  const last = items.at(-1)
  const tail = `${items.length}:${last?.kind === EVENT_KIND.textDelta ? last.text.length : 0}`
  useEffect(() => {
    const el = scroller.current
    if (el && atBottom && tail) el.scrollTop = el.scrollHeight
  }, [tail, atBottom])
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scroller}
        onScroll={onScroll}
        data-testid={CHAT_TESTIDS.taskDetailTranscript}
        className="min-h-0 flex-1 overflow-y-auto px-3 py-2"
      >
        {items.length === 0 ? (
          <p className="py-3 text-[12px] text-fa">{t('chat:task.empty')}</p>
        ) : (
          <ChildTranscript parentIds={[task.id, task.toolCallId]} session={session} />
        )}
      </div>
      {atBottom ? null : (
        <Button
          size={SIZE_SM}
          variant={VARIANT_OUTLINE}
          data-testid={CHAT_TESTIDS.jumpToLatest}
          className="absolute bottom-2 left-1/2 h-6 -translate-x-1/2 gap-1 bg-el text-[11.5px]"
          onClick={() => {
            const el = scroller.current
            if (el) el.scrollTop = el.scrollHeight
          }}
        >
          <ArrowDown size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden />
          {t('chat:list.jumpToLatest')}
        </Button>
      )}
    </div>
  )
}

function SubtaskChips({ node, onSelect }: { node: TaskNode; onSelect(id: string): void }) {
  const t = useT()
  if (node.children.length === 0) return null
  return (
    <Section title={t('chat:tasks.subtasks', { count: node.children.length })}>
      <div className="flex flex-wrap gap-1">
        {node.children.map((c) => (
          <button
            key={c.task.id}
            type={BUTTON_TYPE}
            onClick={() => onSelect(c.task.id)}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-bd bg-el px-1.5 text-[11.5px] text-tx hover:bg-hv"
          >
            <TaskKindIcon task={c.task} size={ICON_PX} />
            {c.task.name}
            <ChevronRight size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="text-fa" />
          </button>
        ))}
      </div>
    </Section>
  )
}

export interface TaskDetailProps {
  node: TaskNode
  parent?: TaskItem
  session: ChatSessionApi
  onBack(): void
  onSelect(taskId: string): void
  onShowInChat(): void
}

function DetailHeader({ node, parent, session, onBack, onSelect, onShowInChat }: TaskDetailProps) {
  const t = useT()
  const { task } = node
  const output = taskResult(session.transcript, task) ?? task.summary ?? childText(session.transcript, task)
  return (
    <div className="flex flex-col gap-1.5 border-b border-bd px-3 pt-2 pb-2.5">
      <div className="flex h-7 items-center gap-1">
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_ICON_XS}
          data-testid={CHAT_TESTIDS.taskDetailBack}
          aria-label={t('chat:tasks.back')}
          title={t('chat:tasks.back')}
          onClick={onBack}
          className="-ml-1 size-6 text-mu"
        >
          <ArrowLeft size={ICON_PX} strokeWidth={ICON_STROKE} />
        </Button>
        {parent ? (
          <button
            type={BUTTON_TYPE}
            onClick={() => onSelect(parent.id)}
            className="min-w-0 truncate text-[11.5px] text-mu hover:text-tx hover:underline"
          >
            {t('chat:tasks.parent', { name: parent.name })}
          </button>
        ) : null}
        <span className="flex-1" />
        <TaskStopButton item={task} session={session} />
        <Button
          variant={VARIANT_GHOST}
          size={SIZE_ICON_XS}
          data-testid={CHAT_TESTIDS.taskDetailShowInChat}
          aria-label={t('chat:tasks.showInChat')}
          title={t('chat:tasks.showInChat')}
          onClick={onShowInChat}
          className="size-6 text-mu hover:text-act"
        >
          <LocateFixed size={ICON_PX} strokeWidth={ICON_STROKE} />
        </Button>
        {output ? (
          <span data-testid={CHAT_TESTIDS.taskDetailCopy}>
            <CopyButton
              text={output}
              label={t('chat:tasks.copy')}
              copiedLabel={t('chat:copy.copied')}
              className="size-6 text-mu"
            />
          </span>
        ) : null}
      </div>
      <TitleBlock task={task} />
    </div>
  )
}

function TitleBlock({ task }: { task: TaskItem }) {
  const now = useNow(isLiveTask(task.status))
  const meta = useTaskMetaParts(task, now, { lastTool: true })
  return (
    <>
      <div className="flex min-w-0 items-center gap-2">
        <TaskKindIcon task={task} size={LARGE_ICON_PX} />
        <h3 className="min-w-0 truncate text-[15px] font-semibold text-tx">{task.name}</h3>
        <TaskStatusPill item={task} />
      </div>
      {task.description ? <p className="text-[12.5px] leading-[1.5] text-tx">{task.description}</p> : null}
      {meta.length > 0 ? <p className="text-[11.5px] tabular-nums text-mu">{meta.join(META_SEPARATOR)}</p> : null}
    </>
  )
}

/** One task: header (actions, timings, usage), prompt, subtasks, live transcript and the final result. */
export function TaskDetail(props: TaskDetailProps) {
  const t = useT()
  const { node, session } = props
  const { task } = node
  const prompt = useMemo(() => taskPrompt(session.transcript, task), [session.transcript, task])
  const result = taskResult(session.transcript, task)
  const finished = !isLiveTask(task.status)
  return (
    <div data-testid={CHAT_TESTIDS.taskDetail} data-item-id={task.id} className="flex min-h-0 flex-1 flex-col">
      <DetailHeader {...props} />
      <div className="flex shrink-0 flex-col gap-3 px-3 pt-2.5">
        {prompt ? (
          <Section title={t('chat:tasks.prompt')}>
            <Prompt text={prompt} />
          </Section>
        ) : null}
        {task.summary && task.summary !== result ? (
          <Section title={t('chat:tasks.summary')}>
            <p className="text-[12.5px] leading-[1.5] text-tx">{task.summary}</p>
          </Section>
        ) : null}
        <SubtaskChips node={node} onSelect={props.onSelect} />
        <h4 className={SECTION_LABEL}>{t('chat:tasks.activity')}</h4>
      </div>
      <Activity task={task} session={session} />
      {finished && result ? (
        <div
          data-testid={CHAT_TESTIDS.taskDetailResult}
          className="max-h-[40%] shrink-0 overflow-y-auto border-t border-bd bg-el px-3 py-2.5"
        >
          <h4 className={cn(SECTION_LABEL, 'mb-1 text-ok')}>{t('chat:tasks.result')}</h4>
          <TaskResultText text={result} />
        </div>
      ) : null}
    </div>
  )
}
