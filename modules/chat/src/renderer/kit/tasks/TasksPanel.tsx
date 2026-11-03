import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { Input } from '@pragma/ui/components/input'
import { Search, X } from '@pragma/ui/icons'
import { type KeyboardEvent, type ReactNode, type PointerEvent as ReactPointerEvent, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import {
  BUTTON_TYPE,
  ICON_PX,
  ICON_STROKE,
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  KEY_ESCAPE,
  POINTER_MOVE,
  POINTER_UP,
  SIZE_ICON_XS,
  TASKS_PANEL,
  TASKS_PANEL_FULL_BELOW_PX,
  TASKS_PANEL_MIN_CHAT_PX,
  VARIANT_GHOST,
} from '../../../constants'
import { CHAT_TESTIDS, type ChatSessionApi, type ChatSlotProps, EVENT_KIND } from '../../../contract'
import { type ChatLayoutApi, useChatLayout } from '../chat-layout'
import {
  findTask,
  TASK_FILTER,
  TASK_FILTERS,
  type TaskNode,
  taskCounts,
  taskForest,
  taskPath,
  taskSections,
} from './model'
import { type TasksPanelView, useTasksPanelStore, useTasksView } from './store'
import { TaskDetail } from './TaskDetail'
import { TaskList, TaskListEmpty } from './TaskList'
import { TASK_SURFACE, TaskSurfaceProvider } from './use-task-reveal'

function findNode(nodes: readonly TaskNode[], id: string): TaskNode | undefined {
  for (const n of nodes) {
    if (n.task.id === id) return n
    const below = findNode(n.children, id)
    if (below) return below
  }
  return undefined
}

/** The left edge: drag (or ←/→) to resize the docked panel. */
function ResizeHandle({ sessionId, width }: { sessionId: string; width: number }) {
  const t = useT()
  const set = (w: number) => useTasksPanelStore.getState().patch(sessionId, { width: w })
  const onPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    const [startX, startW] = [e.clientX, width]
    const move = (m: PointerEvent) => set(startW + startX - m.clientX)
    const up = () => {
      window.removeEventListener(POINTER_MOVE, move)
      window.removeEventListener(POINTER_UP, up)
    }
    window.addEventListener(POINTER_MOVE, move)
    window.addEventListener(POINTER_UP, up)
  }
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KEY_ARROW_LEFT && e.key !== KEY_ARROW_RIGHT) return
    e.preventDefault()
    set(width + (e.key === KEY_ARROW_LEFT ? TASKS_PANEL.keyStep : -TASKS_PANEL.keyStep))
  }
  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable splitter (WAI-ARIA window splitter pattern)
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={t('chat:tasks.resize')}
      aria-valuenow={width}
      aria-valuemin={TASKS_PANEL.minWidth}
      aria-valuemax={TASKS_PANEL.maxWidth}
      data-testid={CHAT_TESTIDS.tasksPanelResize}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      className="absolute inset-y-0 -left-[3px] z-10 w-1.5 cursor-col-resize outline-none transition-colors hover:bg-act/40 focus-visible:bg-act/60"
    />
  )
}

function FilterBar({ sessionId, view }: { sessionId: string; view: TasksPanelView }) {
  const t = useT()
  const patch = (p: Partial<TasksPanelView>) => useTasksPanelStore.getState().patch(sessionId, p)
  return (
    <div className="flex flex-col gap-1.5 border-b border-bd px-3 pt-1 pb-2">
      <fieldset aria-label={t('chat:tasks.filterLabel')} className="m-0 flex min-w-0 gap-0.5 border-0 p-0">
        {TASK_FILTERS.map((f) => (
          <button
            key={f}
            type={BUTTON_TYPE}
            aria-pressed={view.filter === f}
            data-testid={CHAT_TESTIDS.tasksFilter(f)}
            onClick={() => patch({ filter: f })}
            className={cn(
              'h-6 rounded-md px-2 text-[12px] transition-colors',
              view.filter === f ? 'bg-acs font-medium text-act' : 'text-mu hover:bg-hv hover:text-tx',
            )}
          >
            {t(`chat:tasks.filter.${f}`)}
          </button>
        ))}
      </fieldset>
      <div className="relative flex items-center">
        <Search size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="absolute left-2 text-fa" />
        <Input
          data-testid={CHAT_TESTIDS.tasksSearch}
          value={view.query}
          onChange={(e) => patch({ query: e.target.value })}
          placeholder={t('chat:tasks.search')}
          aria-label={t('chat:tasks.search')}
          className="h-7 pl-7 text-[12.5px]"
        />
      </div>
    </div>
  )
}

function PanelHeader({ session, onClose }: { session: ChatSessionApi; onClose(): void }) {
  const t = useT()
  const counts = taskCounts(session.transcript)
  return (
    <div className="flex h-8 shrink-0 items-center gap-2 px-3">
      <h2 className="text-[13px] font-semibold text-tx">{t('chat:tasks.title')}</h2>
      {counts.total > 0 ? (
        <span className="text-[11.5px] tabular-nums text-mu">{t('chat:tasks.total', { count: counts.total })}</span>
      ) : null}
      <span className="flex-1" />
      <Button
        variant={VARIANT_GHOST}
        size={SIZE_ICON_XS}
        data-testid={CHAT_TESTIDS.tasksPanelClose}
        aria-label={t('chat:tasks.close')}
        title={t('chat:tasks.close')}
        onClick={onClose}
        className="size-6 text-mu"
      >
        <X size={ICON_PX} strokeWidth={ICON_STROKE} />
      </Button>
    </div>
  )
}

/** "Show in chat": scrolls the transcript to the root task's card (or its tool call), then flashes the task. */
function showInChat(layout: ChatLayoutApi | null, session: ChatSessionApi, taskId: string): void {
  const path = taskPath(session.transcript, taskId)
  const root = findTask(session.transcript, path[0] ?? taskId)
  if (layout && root && !layout.revealItem(EVENT_KIND.task, root.id) && root.toolCallId)
    layout.revealItem(EVENT_KIND.toolCall, root.toolCallId)
  useTasksPanelStore.getState().reveal(session.sessionId, taskId, path)
}

function PanelBody({ session, view, overlay }: { session: ChatSessionApi; view: TasksPanelView; overlay: boolean }) {
  const layout = useChatLayout()
  const forest = useMemo(() => taskForest(session.transcript), [session.transcript])
  const sections = useMemo(() => taskSections(forest, view.filter, view.query), [forest, view.filter, view.query])
  const patch = (p: Partial<TasksPanelView>) => useTasksPanelStore.getState().patch(session.sessionId, p)
  const node = view.selectedId ? findNode(forest, view.selectedId) : undefined
  if (node) {
    const parentId = taskPath(session.transcript, node.task.id).slice(0, -1).at(-1)
    return (
      <TaskDetail
        node={node}
        parent={parentId ? findTask(session.transcript, parentId) : undefined}
        session={session}
        onBack={() => patch({ selectedId: null })}
        onSelect={(id) => patch({ selectedId: id })}
        onShowInChat={() => {
          showInChat(layout, session, node.task.id)
          if (overlay) patch({ open: false })
        }}
      />
    )
  }
  const filtered = view.filter !== TASK_FILTER.all || view.query.trim() !== ''
  return (
    <>
      {forest.length > 0 ? <FilterBar sessionId={session.sessionId} view={view} /> : null}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sections.length > 0 ? (
          <TaskList sections={sections} onSelect={(id) => patch({ selectedId: id })} />
        ) : (
          <TaskListEmpty filtered={filtered && forest.length > 0} />
        )}
      </div>
    </>
  )
}

/** Docked beside the transcript and composer, or over the transcript when docking would make the chat too narrow. */
function Frame({
  width,
  overlay,
  sessionId,
  onKeyDown,
  children,
}: {
  width: number
  overlay: boolean
  sessionId: string
  onKeyDown(e: KeyboardEvent): void
  children: ReactNode
}) {
  const t = useT()
  return (
    <aside
      data-testid={CHAT_TESTIDS.tasksPanel}
      data-overlay={overlay || undefined}
      aria-label={t('chat:tasks.title')}
      style={{ width }}
      onKeyDown={onKeyDown}
      className={cn(
        'flex min-h-0 max-w-full shrink-0 flex-col border-l border-bd bg-pn',
        overlay
          ? 'absolute inset-y-0 right-0 z-20 shadow-xl animate-in fade-in slide-in-from-right-4 duration-150 motion-reduce:animate-none'
          : 'relative',
      )}
    >
      {overlay ? null : <ResizeHandle sessionId={sessionId} width={width} />}
      {children}
    </aside>
  )
}

/**
 * Docked while even the narrowest panel leaves the chat its minimum width (resizing then never flips the mode; the
 * docked width gives way to the chat), else an overlay at the chosen width.
 */
export function placement(layout: ChatLayoutApi | null, width: number): { overlay: boolean; width: number } {
  const body = layout?.bodyWidth ?? 0
  if (!layout?.overlayHost || body <= 0) return { overlay: false, width }
  if (body - TASKS_PANEL.minWidth < TASKS_PANEL_MIN_CHAT_PX)
    return { overlay: true, width: body < TASKS_PANEL_FULL_BELOW_PX ? body : width }
  return { overlay: false, width: Math.min(width, body - TASKS_PANEL_MIN_CHAT_PX) }
}

/**
 * Side panel: every subagent, workflow and background job of the session (live, history replay too), grouped
 * Running / Waiting / Finished with nesting; a task opens its detail view (live transcript, result, Stop, Show in
 * chat, copy). Toggled by `TasksIndicator` and the Tasks shortcut; open state and width persist per session.
 */
export function TasksPanel({ session }: ChatSlotProps) {
  const view = useTasksView(session.sessionId)
  const layout = useChatLayout()
  const { sessionId } = session
  useEffect(() => useTasksPanelStore.getState().mount(sessionId), [sessionId])
  if (!view.open) return null
  const { overlay, width } = placement(layout, view.width)
  const patch = (p: Partial<TasksPanelView>) => useTasksPanelStore.getState().patch(sessionId, p)
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== KEY_ESCAPE) return
    e.preventDefault()
    e.stopPropagation()
    patch(view.selectedId ? { selectedId: null } : { open: false })
  }
  const panel = (
    <TaskSurfaceProvider value={TASK_SURFACE.panel}>
      <Frame width={width} overlay={overlay} sessionId={sessionId} onKeyDown={onKeyDown}>
        <PanelHeader session={session} onClose={() => patch({ open: false })} />
        <PanelBody session={session} view={view} overlay={overlay} />
      </Frame>
    </TaskSurfaceProvider>
  )
  return overlay && layout?.overlayHost ? createPortal(panel, layout.overlayHost) : panel
}
