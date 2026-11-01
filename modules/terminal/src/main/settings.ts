import type { SettingsSection } from '@pragma/sdk'
import { TERMINAL_SETTINGS_DEFAULTS, type TerminalSettings, TerminalSettingsSchema } from '../contract'

/** The module's settings section; the schema lives in the contract so the renderer can read it too. */
export const terminalSettings: SettingsSection<TerminalSettings> = {
  schema: TerminalSettingsSchema,
  defaults: TERMINAL_SETTINGS_DEFAULTS,
}
