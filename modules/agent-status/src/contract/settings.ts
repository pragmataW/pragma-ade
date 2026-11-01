import { z } from '@pragma/sdk'
import { DEFAULT_ACTIVITY_IDLE_MS, DEFAULT_HOOK_GRACE_MS, MAX_TIMER_MS, MIN_GRACE_MS, MIN_IDLE_MS } from './constants'

export const AgentStatusSettingsSchema = z.object({
  notifications: z.object({ enabled: z.boolean() }),
  fallback: z.object({
    /** Without any hook event for this long, the session switches to activity detection. */
    hookGraceMs: z.number().int().min(MIN_GRACE_MS).max(MAX_TIMER_MS),
    /** Activity mode: silence for this long after output → idle. */
    activityIdleMs: z.number().int().min(MIN_IDLE_MS).max(MAX_TIMER_MS),
  }),
})
export type AgentStatusSettings = z.infer<typeof AgentStatusSettingsSchema>

export const agentStatusSettingsDefaults: AgentStatusSettings = {
  notifications: { enabled: true },
  fallback: { hookGraceMs: DEFAULT_HOOK_GRACE_MS, activityIdleMs: DEFAULT_ACTIVITY_IDLE_MS },
}
