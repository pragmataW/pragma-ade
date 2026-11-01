import type { ZodType } from 'zod'

/** A module's settings section: zod schema + defaults, stored under the module id in settings.json (§4.6). */
export interface SettingsSection<T> {
  schema: ZodType<T>
  defaults: T
}
