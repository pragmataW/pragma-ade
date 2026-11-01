import { defineCommand, z } from '@pragma/sdk'
import { AGENTS_COMMANDS } from './constants'
import { startSessionInputSchema } from './sessions'

/** `agents.newSession` (main) → `AgentSession`. */
export const newSessionArgsSchema = startSessionInputSchema
/** `agents.focusSession` (renderer): select the worktree, activate the view, select the tab. */
export const focusSessionArgsSchema = z.object({ sessionId: z.string().min(1) })
/** `agents.openLauncher` (renderer). */
export const openLauncherArgsSchema = z.object({ worktreeId: z.string().optional() })

export const agentsCommands = {
  newSession: defineCommand({ id: AGENTS_COMMANDS.newSession, args: newSessionArgsSchema }),
  focusSession: defineCommand({ id: AGENTS_COMMANDS.focusSession, args: focusSessionArgsSchema }),
  openLauncher: defineCommand({ id: AGENTS_COMMANDS.openLauncher, args: openLauncherArgsSchema.optional() }),
} as const
