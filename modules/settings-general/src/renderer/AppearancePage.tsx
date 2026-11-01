import { APPEARANCE_MODES, type AppearanceMode, type Density } from '@pragma/sdk'
import { useModuleSettings, useRendererContext, useT, useTheme } from '@pragma/sdk/renderer'
import { DENSITY_ORDER, PALETTE_ORDER } from '../constants'
import type { GeneralSettings } from '../contract/schemas'
import { TEST_IDS } from '../contract/testids'
import { PaletteCard } from './PaletteCard'
import { SectionLabel } from './SectionLabel'
import { Segmented } from './Segmented'

const SECTION = 'mb-6'

/** Mode, palette cards and density (ui-notes 6c); every change applies live through settings → theme controller. */
export function AppearancePage() {
  const t = useT()
  const ctx = useRendererContext<GeneralSettings>()
  const { appearance } = useModuleSettings<GeneralSettings>()
  const theme = useTheme()
  const update = (patch: Partial<GeneralSettings['appearance']>) => void ctx.settings.update({ appearance: patch })
  return (
    <div className="max-w-[720px]">
      <section className={SECTION}>
        <SectionLabel>{t('settings-general:appearance.mode')}</SectionLabel>
        <Segmented<AppearanceMode>
          value={appearance.mode}
          options={APPEARANCE_MODES}
          label={(m) => t(`settings-general:appearance.modes.${m}`)}
          testId={TEST_IDS.modeOption}
          onChange={(mode) => update({ mode })}
        />
      </section>
      <section className={SECTION}>
        <SectionLabel>{t('settings-general:appearance.palette')}</SectionLabel>
        <div className="flex flex-wrap gap-3">
          {PALETTE_ORDER.map((id) => (
            <PaletteCard
              key={id}
              id={id}
              mode={theme.resolved}
              selected={appearance.palette === id}
              onSelect={() => update({ palette: id })}
            />
          ))}
        </div>
      </section>
      <section className={SECTION}>
        <SectionLabel>{t('settings-general:appearance.density')}</SectionLabel>
        <Segmented<Density>
          value={appearance.density}
          options={DENSITY_ORDER}
          label={(d) => t(`settings-general:appearance.densities.${d}`)}
          testId={TEST_IDS.densityOption}
          onChange={(density) => update({ density })}
        />
      </section>
    </div>
  )
}
