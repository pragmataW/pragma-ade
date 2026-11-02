import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Gauge, RefreshCw } from '@pragma/ui/icons'
import type { ReactNode } from 'react'
import { ICON_PX, ICON_STROKE, PERCENT } from '../../../constants'
import { CHAT_TESTIDS, CHAT_TONE, type ChatSlotProps, RATE_LIMIT_STATUS } from '../../../contract'
import { formatClock, formatSeconds } from './lib/format'
import { type ChatTone, TONE_BADGE } from './lib/tone'

function Banner({
  testId,
  tone,
  icon,
  children,
}: {
  testId: string
  tone: ChatTone
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div
      role="status"
      data-testid={testId}
      className={cn('flex min-h-7 items-center gap-2 rounded-lg border px-2.5 py-1 text-[12px]', TONE_BADGE[tone])}
    >
      {icon}
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  )
}

/** Approaching (warn) or hit (err) a usage limit, with the reset time when known. */
export function RateLimitBanner({ session }: ChatSlotProps) {
  const t = useT()
  const r = session.transcript.rateLimit
  if (!r) return null
  const rejected = r.status === RATE_LIMIT_STATUS.rejected
  const head = rejected
    ? t('chat:rateLimit.rejected')
    : t('chat:rateLimit.warning', { percent: Math.round((r.utilization ?? 1) * PERCENT) })
  return (
    <Banner
      testId={CHAT_TESTIDS.rateLimit}
      tone={rejected ? CHAT_TONE.err : CHAT_TONE.warn}
      icon={<Gauge size={ICON_PX} strokeWidth={ICON_STROKE} aria-hidden className="shrink-0" />}
    >
      <span className="font-semibold">{head}</span>
      {r.resetsAt ? <span> · {t('chat:rateLimit.resets', { time: formatClock(r.resetsAt) })}</span> : null}
      {r.message ? <span className="text-mu"> · {r.message}</span> : null}
    </Banner>
  )
}

/** The provider is retrying a failed request: attempt n/max, the delay and the reason. */
export function RetryBanner({ session }: ChatSlotProps) {
  const t = useT()
  const r = session.transcript.retry
  if (!r) return null
  const attempt = r.maxAttempts
    ? t('chat:retry.attemptOf', { attempt: r.attempt, max: r.maxAttempts })
    : t('chat:retry.attempt', { attempt: r.attempt })
  return (
    <Banner
      testId={CHAT_TESTIDS.retry}
      tone={CHAT_TONE.info}
      icon={
        <RefreshCw
          size={ICON_PX}
          strokeWidth={ICON_STROKE}
          aria-hidden
          className="shrink-0 animate-spin motion-reduce:animate-none"
        />
      }
    >
      <span className="font-semibold">{attempt}</span>
      {r.delayMs === undefined ? null : <span> · {t('chat:retry.in', { seconds: formatSeconds(r.delayMs) })}</span>}
      {r.reason ? <span className="text-mu"> · {r.reason}</span> : null}
    </Banner>
  )
}
