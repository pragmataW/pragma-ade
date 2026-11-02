import { useT } from '@pragma/sdk/renderer'
import { CHAT_TESTIDS, type ChatSlotProps } from '../../../contract'

const TOKENS = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const USD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })

/** Tokens in/out (compact) and the session cost when the provider reports it. */
export function UsageMeter({ session }: ChatSlotProps) {
  const t = useT()
  const usage = session.transcript.usage
  if (!usage) return null
  return (
    <span
      data-testid={CHAT_TESTIDS.usage}
      className="inline-flex items-center gap-2 text-[11.5px] tabular-nums text-mu"
    >
      <span>
        {t('chat:usage.tokens', { input: TOKENS.format(usage.inputTokens), output: TOKENS.format(usage.outputTokens) })}
      </span>
      {usage.costUsd === undefined ? null : <span>{USD.format(usage.costUsd)}</span>}
    </span>
  )
}
