import type { RendererContext } from '@pragma/sdk/renderer'
import type { AgentsSettings } from '../contract'
import type { AgentsStore } from './store'

/** The agents renderer context and store; components rendered by other modules' trees read them from here. */
export interface AgentsRendererRuntime {
  ctx: RendererContext<AgentsSettings>
  store: AgentsStore
}

let current: AgentsRendererRuntime | undefined

export const setRuntime = (r: AgentsRendererRuntime | undefined): void => {
  current = r
}

export function getRuntime(): AgentsRendererRuntime {
  if (!current) throw new Error('agents: renderer module is not active')
  return current
}
