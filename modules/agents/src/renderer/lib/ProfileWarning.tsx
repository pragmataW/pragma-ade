import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Icon } from '@pragma/ui/components/icon'
import { ICON_SM } from '../../constants'
import { AGENTS_TESTIDS, type ProfileCheck, RESOLUTION } from '../../contract'

interface Warning {
  testId: string
  text: string
}

function useWarning(check: ProfileCheck | undefined, command: string): Warning | null {
  const t = useT()
  if (!check) return null
  const r = check.resolution
  if (r.status === RESOLUTION.notFound)
    return { testId: AGENTS_TESTIDS.commandWarning, text: t('agents:settings.commandNotFound', { command }) }
  if (r.status === RESOLUTION.notExecutable)
    return { testId: AGENTS_TESTIDS.commandWarning, text: t('agents:settings.commandNotExecutable', { path: r.path }) }
  const c = check.compatibility
  if (c && !c.ok) return { testId: AGENTS_TESTIDS.compatWarning, text: t(c.reasonKey, c.params) }
  return null
}

/** Missing/non-executable command or a provider compatibility warning (settings card and launcher). */
export function ProfileWarning({
  check,
  command,
  compact,
}: {
  check: ProfileCheck | undefined
  command: string
  compact?: boolean
}) {
  const warning = useWarning(check, command)
  if (!warning) return null
  return (
    <div
      data-testid={warning.testId}
      className={cn('flex items-center gap-1.5 text-warn', compact ? 'text-[11.5px]' : 'text-[12px]')}
    >
      <Icon name="triangle-alert" size={ICON_SM} />
      <span>{warning.text}</span>
    </div>
  )
}
