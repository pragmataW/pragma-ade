import { ThemeControllerToken } from '@pragma/sdk'
import { defineMainModule } from '@pragma/sdk/main'
import { GENERAL_SETTINGS_DEFAULTS, type GeneralSettings, GeneralSettingsSchema } from '../contract/schemas'
import { toThemeInput } from '../lib/appearance'

/** Applies the stored appearance through the shell's theme controller and the stored language to main i18n. */
export default defineMainModule<GeneralSettings>({
  settings: { schema: GeneralSettingsSchema, defaults: GENERAL_SETTINGS_DEFAULTS },
  activate(ctx) {
    const theme = ctx.services.get(ThemeControllerToken)
    const apply = (s: GeneralSettings): void => {
      theme.set(toThemeInput(s))
      void ctx.i18n.changeLanguage(s.language)
    }
    apply(ctx.settings.get())
    ctx.settings.onChange(apply)
  },
})
