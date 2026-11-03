import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { CheckCheck, CircleAlert, CirclePause, LoaderCircle, Workflow } from '@pragma/ui/icons'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BUTTON_TYPE,
  ICON_STROKE,
  META_SEPARATOR,
  SMALL_ICON_PX,
  TASK_PULSE_MS,
  TASKS_SHORTCUT,
} from '../../../constants'
import { CHAT_TESTIDS, type ChatSlotProps } from '../../../contract'
import { CHAT_RESPONSIVE } from '../responsive'
import { type TaskCounts, taskCounts } from './model'
import { shortcutLabel } from './shortcut-label'
import { useTasksPanelStore, useTasksView } from './store'

/** True for a moment whenever `total` grows (a new task started). */
function usePulse(total: number): boolean {
  const seen = useRef(total)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    const grew = total > seen.current
    seen.current = total
    if (!grew) return
    setPulsing(true)
    const timer = setTimeout(() => setPulsing(false), TASK_PULSE_MS)
    return () => clearTimeout(timer)
  }, [total])
  return pulsing
}

/** The leading glyph: what most needs attention (running > waiting > failed > all done). */
function LeadGlyph({ counts }: { counts: TaskCounts }) {
  const props = { size: SMALL_ICON_PX, strokeWidth: ICON_STROKE, 'aria-hidden': true, className: 'shrink-0' }
  if (counts.running > 0)
    return <LoaderCircle {...props} className="shrink-0 animate-spin text-info motion-reduce:animate-none" />
  if (counts.waiting > 0) return <CirclePause {...props} className="shrink-0 text-warn" />
  if (counts.failed > 0) return <CircleAlert {...props} className="shrink-0 text-err" />
  return <CheckCheck {...props} className="shrink-0 text-ok" />
}

/** "2 running · 1 waiting · 5 done · 1 failed" (zero counts left out). */
function useCountsLabel(counts: TaskCounts): string {
  const t = useT()
  return (['running', 'waiting', 'done', 'failed'] as const)
    .filter((k) => counts[k] > 0)
    .map((k) => t(`chat:tasks.count.${k}`, { count: counts[k] }))
    .join(META_SEPARATOR)
}

/**
 * Header slot: a compact pill with the live task counts (workflow mark when one runs); toggles the Tasks panel
 * (also `TASKS_SHORTCUT`). Hidden while the session has no tasks; pulses when a new one starts.
 */
export function TasksIndicator({ session }: ChatSlotProps) {
  const t = useT()
  const counts = useMemo(() => taskCounts(session.transcript), [session.transcript])
  const { open } = useTasksView(session.sessionId)
  const pulsing = usePulse(counts.total)
  const label = useCountsLabel(counts)
  if (counts.total === 0) return null
  const title = `${t(open ? 'chat:tasks.hide' : 'chat:tasks.show')} (${shortcutLabel(TASKS_SHORTCUT.accelerator)})`
  return (
    <button
      type={BUTTON_TYPE}
      data-testid={CHAT_TESTIDS.tasksIndicator}
      data-pulse={pulsing || undefined}
      aria-pressed={open}
      aria-label={`${t('chat:tasks.title')}: ${label}`}
      aria-keyshortcuts={TASKS_SHORTCUT.accelerator}
      title={title}
      onClick={() => useTasksPanelStore.getState().toggle(session.sessionId)}
      className={cn(
        'relative inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-[11.5px] tabular-nums transition-colors',
        open ? 'border-act/40 bg-acs text-act' : 'border-bd text-mu hover:bg-hv hover:text-tx',
      )}
    >
      {pulsing ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 animate-ping rounded-full border border-info/60 [animation-iteration-count:2] motion-reduce:hidden"
        />
      ) : null}
      <LeadGlyph counts={counts} />
      {counts.workflows > 0 ? (
        <Workflow size={SMALL_ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
      ) : null}
      <span className={cn('whitespace-nowrap', CHAT_RESPONSIVE.wideOnly)}>{label}</span>
      <span className={CHAT_RESPONSIVE.narrowOnly}>{counts.running || counts.total}</span>
    </button>
  )
}
