import { z } from '@pragma/sdk'
import type { AgentProfile } from './profiles'
import type { AgentSession } from './sessions'

/** `agentSession.view` entry: `{ id, order, match(props) => boolean, component }`; the first match wins. */
export interface AgentSessionViewProps {
  session: AgentSession
  active: boolean
}
export interface AgentSessionTabBadgesProps {
  session: AgentSession
}
export interface AgentSessionToolbarProps {
  session: AgentSession
}

export const launcherOptionsSchema = z.object({ mode: z.string() }).catchall(z.unknown())
export type LauncherOptions = z.infer<typeof launcherOptionsSchema>

/** `agentLauncher.options` props; `options.mode` becomes `startSession.mode`. */
export interface AgentLauncherOptionsProps {
  worktreeId: string
  profile: AgentProfile | null
  options: LauncherOptions
  setOptions(patch: Partial<LauncherOptions>): void
}
