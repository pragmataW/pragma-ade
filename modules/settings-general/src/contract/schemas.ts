import { APPEARANCE_MODES, DENSITIES, PALETTE_IDS, z } from '@pragma/sdk'
import { DEFAULT_APPEARANCE, DEFAULT_LANGUAGE } from '../constants'

/** Each field falls back to its default on its own, so one bad stored value does not reset the others. */
export const AppearanceSettingsSchema = z.object({
  mode: z.enum(APPEARANCE_MODES).default(DEFAULT_APPEARANCE.mode).catch(DEFAULT_APPEARANCE.mode),
  palette: z.enum(PALETTE_IDS).default(DEFAULT_APPEARANCE.palette).catch(DEFAULT_APPEARANCE.palette),
  density: z.enum(DENSITIES).default(DEFAULT_APPEARANCE.density).catch(DEFAULT_APPEARANCE.density),
})

/** The `settings-general` section: appearance (mode, palette, density) and language (§10.2). */
export const GeneralSettingsSchema = z.object({
  appearance: AppearanceSettingsSchema.default({ ...DEFAULT_APPEARANCE }),
  language: z.string().default(DEFAULT_LANGUAGE).catch(DEFAULT_LANGUAGE),
})
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>

export const GENERAL_SETTINGS_DEFAULTS: GeneralSettings = {
  appearance: { ...DEFAULT_APPEARANCE },
  language: DEFAULT_LANGUAGE,
}
