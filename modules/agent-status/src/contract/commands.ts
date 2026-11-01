import { defineCommand, z } from '@pragma/sdk'
import { OPEN_SESSION_COMMAND } from './constants'

/** `agent-status.openSession`: select the worktree and focus the session (notification click). */
export const OpenSessionArgsSchema = z.object({ worktreeId: z.string(), sessionId: z.string() })
export type OpenSessionArgs = z.infer<typeof OpenSessionArgsSchema>
export const openSessionCommand = defineCommand({ id: OPEN_SESSION_COMMAND, args: OpenSessionArgsSchema })
