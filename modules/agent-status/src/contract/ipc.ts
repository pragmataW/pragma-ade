import { defineIpc, defineIpcEvent, z } from '@pragma/sdk'
import { AGENT_STATUS_IPC } from './constants'
import { SessionStatusInfoSchema, WorktreeStatusInfoSchema } from './status'

export const AgentStatusListSchema = z.object({
  sessions: z.array(SessionStatusInfoSchema),
  worktrees: z.array(WorktreeStatusInfoSchema),
})
export type AgentStatusList = z.infer<typeof AgentStatusListSchema>

export const AgentStatusIpc = {
  list: defineIpc({ channel: AGENT_STATUS_IPC.list, input: z.void(), output: AgentStatusListSchema }),
} as const

/** Main → renderer (`ctx.ipc.publish`). */
export const AgentStatusIpcEvents = {
  sessionChanged: defineIpcEvent({ channel: AGENT_STATUS_IPC.sessionChanged, payload: SessionStatusInfoSchema }),
  worktreeChanged: defineIpcEvent({ channel: AGENT_STATUS_IPC.worktreeChanged, payload: WorktreeStatusInfoSchema }),
} as const
