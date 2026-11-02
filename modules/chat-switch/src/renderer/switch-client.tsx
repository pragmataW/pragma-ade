/** The ONLY renderer file touching the SDK context: the toggle's client (stubbed in tests). */
import type { ConfirmInput, Disposable } from '@pragma/sdk'
import { type RendererContext, useRendererContext } from '@pragma/sdk/renderer'
import { type ComponentType, createContext, useContext, useMemo } from 'react'
import {
  type ChangedEvent,
  type ConflictEvent,
  chatSwitchIpc,
  chatSwitchIpcEvents,
  type SwitchEligibility,
  type SwitchResult,
  type SwitchTarget,
} from '../contract'

export interface SwitchClient {
  eligibility(sessionId: string): Promise<SwitchEligibility>
  switchTo(sessionId: string, target: SwitchTarget): Promise<SwitchResult>
  onChanged(cb: (e: ChangedEvent) => void): Disposable
  onConflict(cb: (e: ConflictEvent) => void): Disposable
  confirm(o: ConfirmInput): Promise<boolean>
}

export const createSwitchClient = (ctx: Pick<RendererContext, 'ipc' | 'dialogs'>): SwitchClient => ({
  eligibility: (sessionId) => ctx.ipc.invoke(chatSwitchIpc.eligibility, { sessionId }),
  switchTo: (sessionId, target) => ctx.ipc.invoke(chatSwitchIpc.switch, { sessionId, target }),
  onChanged: (cb) => ctx.ipc.subscribe(chatSwitchIpcEvents.changed, cb),
  onConflict: (cb) => ctx.ipc.subscribe(chatSwitchIpcEvents.conflict, cb),
  confirm: (o) => ctx.dialogs.confirm(o),
})

const SwitchClientContext = createContext<SwitchClient | null>(null)
export const SwitchClientProvider = SwitchClientContext.Provider

export class MissingSwitchClientError extends Error {}

export function useSwitchClient(): SwitchClient {
  const client = useContext(SwitchClientContext)
  if (!client) throw new MissingSwitchClientError('useSwitchClient outside <SwitchClientProvider>')
  return client
}

/** Wraps a registered component so it gets the module's client. */
export function withSwitchClient<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function WithSwitchClient(props: P) {
    const ctx = useRendererContext()
    const client = useMemo(() => createSwitchClient(ctx), [ctx])
    return (
      <SwitchClientProvider value={client}>
        <Component {...props} />
      </SwitchClientProvider>
    )
  }
  WithSwitchClient.displayName = `withSwitchClient(${Component.displayName ?? Component.name})`
  return WithSwitchClient
}
