import { useRendererContext, useT, useTheme } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { Icon } from '@pragma/ui/components/icon'
import { QUICK_TOGGLE_ICONS } from '../constants'
import type { GeneralSettings } from '../contract/schemas'
import { TEST_IDS } from '../contract/testids'
import { nextQuickMode } from '../lib/appearance'

/** Title-bar dark/light toggle (ui-notes): stores the opposite of the resolved mode. */
export function QuickThemeToggle() {
  const t = useT()
  const ctx = useRendererContext<GeneralSettings>()
  const next = nextQuickMode(useTheme())
  const label = next === 'dark' ? t('settings-general:quickTheme.toDark') : t('settings-general:quickTheme.toLight')
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      data-testid={TEST_IDS.quickTheme}
      onClick={() => void ctx.settings.update({ appearance: { mode: next } })}
    >
      <Icon name={QUICK_TOGGLE_ICONS[next]} />
    </Button>
  )
}
