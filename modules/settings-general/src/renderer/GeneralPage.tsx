import { useModuleSettings, useRendererContext, useRendererHost, useT } from '@pragma/sdk/renderer'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@pragma/ui/components/select'
import { LANGUAGE_DISPLAY_TYPE } from '../constants'
import type { GeneralSettings } from '../contract/schemas'
import { TEST_IDS } from '../contract/testids'
import { SectionLabel } from './SectionLabel'

const LABEL_ID = 'settings-general-language-label'

/** Language picker; names come from `Intl.DisplayNames` in the current UI language. */
export function GeneralPage() {
  const t = useT()
  const ctx = useRendererContext<GeneralSettings>()
  const { appInfo, i18n } = useRendererHost()
  const settings = useModuleSettings<GeneralSettings>()
  const names = new Intl.DisplayNames([i18n.language], { type: LANGUAGE_DISPLAY_TYPE })
  return (
    <section className="max-w-[560px]">
      <SectionLabel id={LABEL_ID}>{t('settings-general:general.language')}</SectionLabel>
      <p className="mb-2 text-[var(--mu)] text-xs">{t('settings-general:general.languageHint')}</p>
      <Select value={settings.language} onValueChange={(language) => void ctx.settings.update({ language })}>
        <SelectTrigger data-testid={TEST_IDS.languageSelect} aria-labelledby={LABEL_ID} className="w-60">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {appInfo.languages.map((lng) => (
            <SelectItem key={lng} value={lng}>
              {names.of(lng) ?? lng}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </section>
  )
}
