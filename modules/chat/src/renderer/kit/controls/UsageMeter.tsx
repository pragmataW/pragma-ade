import { useT } from '@pragma/sdk/renderer'
import { CHAT_TESTIDS, type ChatSlotProps } from '../../../contract'
import { formatTokens, formatUsd } from '../parts/lib/format'
import { CHAT_RESPONSIVE } from '../responsive'

/** Tokens in/out (compact) and the session cost when the provider reports it. */
export function UsageMeter({ session }: ChatSlotProps) {
  const t = useT()
  const usage = session.transcript.usage
  if (!usage) return null
  return (
    <span
      data-testid={CHAT_TESTIDS.usage}
      className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-[11.5px] tabular-nums text-mu"
    >
      <span className={usage.costUsd === undefined ? undefined : CHAT_RESPONSIVE.wideOnly}>
        {t('chat:usage.tokens', { input: formatTokens(usage.inputTokens), output: formatTokens(usage.outputTokens) })}
      </span>
      {usage.costUsd === undefined ? null : <span>{formatUsd(usage.costUsd)}</span>}
    </span>
  )
}
