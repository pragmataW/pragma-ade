import { z } from '@pragma/sdk'

export const agentsSettingsSchema = z.object({ confirmCloseRunning: z.boolean() })
export type AgentsSettings = z.infer<typeof agentsSettingsSchema>
export const agentsSettingsDefaults: AgentsSettings = { confirmCloseRunning: true }
