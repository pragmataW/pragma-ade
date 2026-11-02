import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { Zap } from '@pragma/ui/icons'
import { FAST_MODE_OPTION } from '../../main/chat/constants'
import { FAST_MODE_TESTID, ICON_PX, ICON_STROKE } from './constants'
import type { ChatSlotProps } from './kit'

/** A bolt toggle for the model's fast mode; hidden when the session does not describe it (unsupported model). */
export function FastModeToggle({ session }: ChatSlotProps) {
  const t = useT()
  const d = session.transcript.info.options.find((o) => o.key === FAST_MODE_OPTION)
  if (!d) return null
  const on = d.current === true
  const hint = `${t(d.labelKey)} — ${t(d.descriptionKey ?? d.labelKey)}`
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      data-testid={FAST_MODE_TESTID}
      aria-pressed={on}
      aria-label={t(d.labelKey)}
      title={hint}
      onClick={() => void session.setOption(d.key, !on)}
      className={cn('size-6 rounded-md', on ? 'bg-acs text-act hover:bg-acs' : 'text-mu hover:text-tx')}
    >
      <Zap size={ICON_PX} strokeWidth={ICON_STROKE} className={cn(on && 'fill-current')} />
    </Button>
  )
}
