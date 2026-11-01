import type { PtyService } from '@pragma/module-terminal/contract'
import type { ProfileChecker } from './launch/profile-check'
import type { ProfilesStore } from './profiles/profiles-store'
import type { AgentSessionsServiceImpl } from './service/agent-sessions-service'

/** What `test-hooks.ts` needs from the active module (set in `activate`). */
export interface AgentsMainRuntime {
  service: AgentSessionsServiceImpl
  profiles: ProfilesStore
  checker: ProfileChecker
  pty: Pick<PtyService, 'onData'>
}

let current: AgentsMainRuntime | undefined

export const setMainRuntime = (r: AgentsMainRuntime | undefined): void => {
  current = r
}

export function getMainRuntime(): AgentsMainRuntime {
  if (!current) throw new Error('agents: main module is not active')
  return current
}
