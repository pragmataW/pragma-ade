import { z } from 'zod'

export type { SettingsSection } from '../common/settings'

/** The shell-owned `core` section of settings.json. */
export const CoreSettingsSchema = z.object({
  modules: z.object({ disabled: z.array(z.string()).default([]) }).default({ disabled: [] }),
  layout: z.record(z.string(), z.string()).default({}),
})
export type CoreSettings = z.infer<typeof CoreSettingsSchema>
export const CORE_SETTINGS_DEFAULTS: CoreSettings = { modules: { disabled: [] }, layout: {} }
