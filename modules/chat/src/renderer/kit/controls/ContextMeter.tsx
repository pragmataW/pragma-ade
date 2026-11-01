import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { CONTEXT_WARN_RATIO, PERCENT, RING } from '../../../constants'
import { CHAT_TESTIDS, type ChatSlotProps, type UsageEvent } from '../../../contract'

/** Context use in percent; null when the provider did not report it. */
export function contextPercent(usage: UsageEvent | null | undefined): number | null {
  if (!usage?.contextTokens || !usage.contextWindow) return null
  return Math.min(PERCENT, Math.round((usage.contextTokens / usage.contextWindow) * PERCENT))
}

export const CONTEXT_VARIANTS = ['bar', 'ring', 'text'] as const
export type ContextVariant = (typeof CONTEXT_VARIANTS)[number]
const [BAR, RING_VARIANT, TEXT] = CONTEXT_VARIANTS
const NO_FILL = 'none'

function Ring({ percent }: { percent: number }) {
  const circumference = TWO_PI * RING.r
  return (
    <svg width={RING.box} height={RING.box} viewBox={`0 0 ${RING.box} ${RING.box}`} aria-hidden className="-rotate-90">
      <circle cx={RING.c} cy={RING.c} r={RING.r} fill={NO_FILL} stroke="var(--bd2)" strokeWidth={RING.stroke} />
      <circle
        cx={RING.c}
        cy={RING.c}
        r={RING.r}
        fill={NO_FILL}
        stroke="currentColor"
        strokeWidth={RING.stroke}
        strokeDasharray={`${(circumference * percent) / PERCENT} ${circumference}`}
      />
    </svg>
  )
}

/** Presentational meter: ring (composer), bar or text (status bar); hidden when unknown, `warn` ≥ 80 %. */
export function ContextMeterView({
  usage,
  variant = RING_VARIANT,
  testId = CHAT_TESTIDS.context,
}: {
  usage: UsageEvent | null | undefined
  variant?: ContextVariant
  testId?: string
}) {
  const t = useT()
  const percent = contextPercent(usage)
  if (percent === null) return null
  const label = t('chat:usage.context', { percent })
  const warn = percent >= CONTEXT_WARN_RATIO * PERCENT
  return (
    <span
      data-testid={testId}
      data-percent={percent}
      title={label}
      className={cn('inline-flex items-center gap-1.5 text-[11.5px] tabular-nums', warn ? 'text-warn' : 'text-mu')}
    >
      {variant === RING_VARIANT ? <Ring percent={percent} /> : null}
      {variant === BAR ? (
        <span className="h-1 w-16 overflow-hidden rounded-full bg-bd2">
          <span className="block h-full bg-current" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
      <span className={variant === TEXT ? undefined : 'sr-only'}>{label}</span>
    </span>
  )
}

/** Composer toolbar slot (ring). */
export function ContextMeter({ session }: ChatSlotProps) {
  return <ContextMeterView usage={session.transcript.usage} variant={RING_VARIANT} />
}
