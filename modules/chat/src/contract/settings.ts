import { z } from '@pragma/sdk'
import { CHAT_MODES, DEFAULT_STARTUP_TIMEOUT_MS, MIN_STARTUP_TIMEOUT_MS } from './constants'

export const chatSettingsSchema = z.object({
  /** Preselected mode in the New agent dialog. */
  defaultMode: z.enum(CHAT_MODES),
  /** How long a CLI may take to start the stream-json protocol before chat mode counts as unsupported. */
  startupTimeoutMs: z.number().int().min(MIN_STARTUP_TIMEOUT_MS),
})
export type ChatSettings = z.infer<typeof chatSettingsSchema>

export const chatSettingsDefaults: ChatSettings = {
  defaultMode: CHAT_MODES[0],
  startupTimeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
}
