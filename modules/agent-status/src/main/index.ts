import {
  AgentSessionsServiceToken,
  agentSessionExited,
  agentSessionStarted,
  agentSessionUpdated,
} from '@pragma/module-agents/contract'
import { BridgeServerToken } from '@pragma/module-bridge/contract'
import { ProjectsServiceToken, worktreeSelected } from '@pragma/module-projects/contract'
import type { Disposable } from '@pragma/sdk'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import {
  AgentStatusServiceToken,
  type AgentStatusSettings,
  AgentStatusSettingsSchema,
  agentBridge,
  agentSessionStatusChanged,
  agentStatusSettingsDefaults,
  STATUS_SOURCE,
} from '../contract'
import { realClock } from './clock'
import { createHookEventHandler } from './hook-ingest'
import { registerStatusIpc, statusPublisher } from './ipc'
import { createStatusLaunchDecorator } from './launch-decorator'
import { type AgentStatusRuntime, setRuntime } from './runtime'
import { createAgentStatusService } from './service'
import { StatusStore } from './status-store'

type Ctx = MainContext<AgentStatusSettings>

const timingsOf = (s: AgentStatusSettings) => ({ ...s.fallback })

function wireEvents(ctx: Ctx, store: StatusStore): Disposable[] {
  return [
    ctx.events.on(agentSessionStarted, (p) => {
      const t = store.track({ sessionId: p.sessionId, worktreeId: p.worktreeId, source: STATUS_SOURCE.activity })
      if (p.ptyId === null) t.setSource(STATUS_SOURCE.external)
    }),
    ctx.events.on(agentSessionExited, (p) => store.exited(p.sessionId)),
    ctx.events.on(agentSessionUpdated, (p) => {
      if (p.session.closedAt !== null) store.forget(p.session.id)
    }),
    ctx.events.on(worktreeSelected, (p) => {
      if (p.worktreeId) store.markWorktreeRead(p.worktreeId)
    }),
  ]
}

/** Builds the runtime: store, launch decorator, bridge namespace, events, IPC and the service. */
export function activateAgentStatus(ctx: Ctx): AgentStatusRuntime {
  const agents = ctx.services.get(AgentSessionsServiceToken)
  const projects = ctx.services.get(ProjectsServiceToken)
  const bridge = ctx.services.tryGet(BridgeServerToken)
  const statusCapability = (providerId: string) => ctx.providers.capability(providerId, 'status')
  const store = new StatusStore({
    agents,
    emitStatusChanged: (p) => ctx.events.emit(agentSessionStatusChanged, p),
    publish: statusPublisher(ctx.ipc),
    activeWorktreeId: () => projects.getActiveWorktreeId(),
    clock: realClock,
    timings: () => timingsOf(ctx.settings.get()),
    log: ctx.log,
  })
  const disposers: (() => void)[] = [
    agents.registerLaunchDecorator(
      createStatusLaunchDecorator({ bridge: () => bridge, statusCapability, store, log: ctx.log }),
    ),
  ]
  if (bridge)
    disposers.push(
      bridge.registerHandler(agentBridge, createHookEventHandler({ store, agents, statusCapability, log: ctx.log })),
    )
  const disposables = [
    ...wireEvents(ctx, store),
    registerStatusIpc(ctx.ipc, () => store),
    ctx.settings.onChange((s) => store.setTimings(timingsOf(s))),
  ]
  const service = createAgentStatusService({ store, agents })
  ctx.services.provide(AgentStatusServiceToken, service)
  return {
    store,
    service,
    async dispose() {
      for (const d of disposers.splice(0)) d()
      for (const d of disposables.splice(0)) d.dispose()
      await store.flush()
      store.dispose()
    },
  }
}

let runtime: AgentStatusRuntime | undefined

export default defineMainModule<AgentStatusSettings>({
  settings: { schema: AgentStatusSettingsSchema, defaults: agentStatusSettingsDefaults },
  activate(ctx) {
    runtime = activateAgentStatus(ctx)
    setRuntime(runtime)
  },
  async deactivate() {
    await runtime?.dispose()
    runtime = undefined
    setRuntime(undefined)
  },
})
