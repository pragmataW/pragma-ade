import { MODULE_STATE } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Icon } from '@pragma/ui/components/icon'
import { Switch } from '@pragma/ui/components/switch'
import { BETA_FEATURES, OUTLINE_VARIANT } from '../constants'
import { TEST_IDS } from '../contract/testids'
import { RestartBanner, useModuleToggles } from './module-toggles'

const FEATURE_ICON_PX = 18

/**
 * Features still in beta, each backed by a module: switching one off disables its module (and the modules that need
 * it), so the feature is gone everywhere after a restart. A feature whose module is not installed is not listed.
 */
export function BetaPage() {
  const t = useT()
  const modules = useModuleToggles()
  const features = BETA_FEATURES.flatMap((f) => {
    const status = modules.statuses.find((s) => s.id === f.module)
    return status ? [{ ...f, status }] : []
  })
  return (
    <div className="max-w-[820px]">
      <p className="mb-3 text-[var(--mu)] text-xs">{t('settings-general:beta.intro')}</p>
      <RestartBanner {...modules.restart} />
      {features.length === 0 && modules.statuses.length > 0 && (
        <p data-testid={TEST_IDS.betaEmpty} className="text-[var(--mu)]">
          {t('settings-general:beta.empty')}
        </p>
      )}
      <ul className="divide-y divide-[var(--bd)] rounded-[var(--radius-card)] border border-[var(--bd)] empty:hidden">
        {features.map(({ id, icon, status }) => (
          <li key={id} data-testid={TEST_IDS.betaFeature(id)} className="flex items-start gap-3 px-3 py-3">
            <Icon name={icon} size={FEATURE_ICON_PX} className="mt-0.5 shrink-0 text-[var(--mu)]" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{t(`settings-general:beta.features.${id}.title`)}</span>
                <Badge variant={OUTLINE_VARIANT} className="border-[var(--ac)] text-[var(--ac)]">
                  {t('settings-general:beta.badge')}
                </Badge>
                {status.state === MODULE_STATE.failed && (
                  <Badge variant={OUTLINE_VARIANT} className="border-[var(--err)] text-[var(--err)]">
                    {t('settings-general:modules.state.failed')}
                  </Badge>
                )}
              </div>
              <p className="mt-0.5 text-[var(--mu)] text-xs">{t(`settings-general:beta.features.${id}.description`)}</p>
            </div>
            <Switch
              data-testid={TEST_IDS.betaToggle(id)}
              aria-label={t(`settings-general:beta.features.${id}.title`)}
              checked={modules.enabled(status)}
              onCheckedChange={(enabled) => modules.toggle(status.id, enabled)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
