import type { AgentStatusService } from '../contract'
import type { StatusStore } from './status-store'

/** The live objects of the activated module (read by test hooks only). */
export interface AgentStatusRuntime {
  store: StatusStore
  service: AgentStatusService
  dispose(): Promise<void>
}

let current: AgentStatusRuntime | undefined

export const getRuntime = (): AgentStatusRuntime | undefined => current
export const setRuntime = (r: AgentStatusRuntime | undefined): void => {
  current = r
}
