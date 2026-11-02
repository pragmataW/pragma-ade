import { SESSION_STATUS } from '@pragma/module-agents/contract'
import { useT } from '@pragma/sdk/renderer'
import { useEffect, useState } from 'react'
import { ELAPSED_TICK_MS, MS_PER_SECOND, SECONDS_PAD, SECONDS_PER_MINUTE } from '../../../constants'
import { CHAT_TESTIDS, type ChatSlotProps, type ChatTranscript, EVENT_KIND, TOOL_STATUS } from '../../../contract'
import { StatusGlyph } from './lib/StatusGlyph'

/** `12s`, `3m 05s`. */
export function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / MS_PER_SECOND))
  const m = Math.floor(total / SECONDS_PER_MINUTE)
  const s = total % SECONDS_PER_MINUTE
  return m > 0 ? `${m}m ${String(s).padStart(SECONDS_PAD, '0')}s` : `${s}s`
}

/** The title of the last running tool (the current action), if any. */
export function currentAction(t: ChatTranscript): string | undefined {
  for (let i = t.items.length - 1; i >= 0; i--) {
    const item = t.items[i]
    if (item?.kind === EVENT_KIND.toolCall && item.status === TOOL_STATUS.running) return item.title ?? item.name
  }
  return undefined
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), ELAPSED_TICK_MS)
    return () => clearInterval(timer)
  }, [active])
  return now
}

/** "ring + current action + elapsed · esc to interrupt" while the agent works (ui-notes). */
export function WorkingLine({ session }: ChatSlotProps) {
  const t = useT()
  const working = session.status === SESSION_STATUS.working
  const now = useNow(working)
  if (!working) return null
  const startedAt = session.transcript.turnStartedAt ?? now
  return (
    <div data-testid={CHAT_TESTIDS.workingLine} className="flex h-7 items-center gap-2 text-[12px]">
      <StatusGlyph status={SESSION_STATUS.working} turnCompleted={false} />
      <span className="min-w-0 truncate text-tx">
        {currentAction(session.transcript) ?? t('chat:working.thinking')}
      </span>
      <span className="shrink-0 text-mu">{t('chat:working.meta', { elapsed: formatElapsed(now - startedAt) })}</span>
    </div>
  )
}
