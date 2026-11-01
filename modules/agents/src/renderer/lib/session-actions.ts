import {
  type AgentSession,
  type AgentsSettings,
  agentsIpc,
  agentsSettingsDefaults,
  agentsSettingsSchema,
  isRunningStatus,
} from '../../contract'
import { getRuntime } from '../runtime'

const settings = (): AgentsSettings => {
  const parsed = agentsSettingsSchema.safeParse({ ...agentsSettingsDefaults, ...getRuntime().ctx.settings.get() })
  return parsed.success ? parsed.data : agentsSettingsDefaults
}

/** Errors of fire-and-forget UI actions go to the console (the session row carries the real state). */
const report = (what: string) => (e: unknown) => console.warn(`agents: ${what} failed`, e)

export function closeSessionNow(id: string): void {
  getRuntime().ctx.ipc.invoke(agentsIpc.closeSession, { id }).catch(report('closeSession'))
}

/** Running + `confirmCloseRunning` → the confirmation dialog; otherwise closes at once. */
export function requestClose(session: AgentSession): void {
  if (isRunningStatus(session.status) && settings().confirmCloseRunning)
    getRuntime().store.setState({ closing: session.id })
  else closeSessionNow(session.id)
}

export function relaunch(id: string): void {
  getRuntime().ctx.ipc.invoke(agentsIpc.relaunchSession, { id }).catch(report('relaunchSession'))
}

export function stop(id: string): void {
  getRuntime().ctx.ipc.invoke(agentsIpc.stopSession, { id }).catch(report('stopSession'))
}
