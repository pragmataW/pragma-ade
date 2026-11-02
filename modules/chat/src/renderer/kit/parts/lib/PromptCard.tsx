import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Check, X } from '@pragma/ui/icons'
import type { ReactNode } from 'react'
import { ICON_PX, ICON_STROKE } from '../../../../constants'
import { CHAT_TESTIDS, RESPONSE_OUTCOME, type RESPONSE_OUTCOMES } from '../../../../contract'

type Icon = typeof Check

/**
 * The shell of an interactive card (question, plan): accent border while open, the title row, the body and either
 * the actions (open) or the outcome with the provider's summary (resolved).
 */
export function PromptCard({
  testId,
  icon: IconC,
  title,
  resolved,
  summary,
  actions,
  children,
}: {
  testId: string
  icon: Icon
  title: string
  resolved?: (typeof RESPONSE_OUTCOMES)[number]
  summary?: string
  actions: ReactNode
  children: ReactNode
}) {
  const t = useT()
  const open = !resolved
  return (
    <section
      data-testid={testId}
      data-resolved={resolved ?? ''}
      aria-label={title}
      className={cn('overflow-hidden rounded-lg border bg-el', open ? 'border-act/60 shadow-sm' : 'border-bd')}
    >
      <header className={cn('flex h-8 items-center gap-2 border-b border-bd px-2.5', open && 'bg-acs/60')}>
        <IconC size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0 text-act" />
        <h3 className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-tx">{title}</h3>
      </header>
      <div className="px-2.5 py-2">{children}</div>
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-bd px-2.5 py-2">
        {open ? (
          actions
        ) : (
          <span
            data-testid={CHAT_TESTIDS.resolvedSummary}
            className="flex min-w-0 items-center gap-1.5 text-[12px] text-mu"
          >
            {resolved === RESPONSE_OUTCOME.answered ? (
              <Check size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="text-ok" />
            ) : (
              <X size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="text-fa" />
            )}
            <span>{t(`chat:prompt.outcome.${resolved}`)}</span>
            {summary ? <span className="min-w-0 truncate text-tx">· {summary}</span> : null}
          </span>
        )}
      </footer>
    </section>
  )
}
