import { agentSessionStatusChanged } from '@pragma/module-agent-status/contract'
import {
  type AgentSession,
  type AgentSessionsService,
  agentSessionExited,
  agentSessionUpdated,
  isRunningStatus,
} from '@pragma/module-agents/contract'
import type { ChatService, ChatStartGuardResult } from '@pragma/module-chat/contract'
import type { Disposable, Logger } from '@pragma/sdk'
import type { MainContext, MainIpcApi } from '@pragma/sdk/main'
import { SWITCH_REASON, switchReasonKey } from '../constants'
import {
  type ChatSwitchService,
  chatSwitchIpc,
  chatSwitchIpcEvents,
  type ExternalSessionGuard,
  SWITCH_PHASE,
  SWITCH_TARGET,
} from '../contract'
import { createExternalSessionGuard } from './external-session-guard'
import { createResumeDecorator } from './resume-decorator'
import { createChatSwitchService } from './switch-service'

export interface ChatSwitchMainDeps {
  agents: Pick<AgentSessionsService, 'getSession' | 'getProfile' | 'relaunchSession' | 'registerLaunchDecorator'>
  chat: Pick<ChatService, 'registerStartGuard'>
  providers: Pick<MainContext['providers'], 'capability'>
  events: Pick<MainContext['events'], 'on'>
  ipc: Pick<MainIpcApi, 'handle' | 'publish'>
  worktreePath(worktreeId: string): Promise<string | null>
  provide(guard: ExternalSessionGuard, service: ChatSwitchService): void
  log: Pick<Logger, 'info' | 'warn'>
}

export interface ChatSwitchMain {
  guard: ExternalSessionGuard
  service: ChatSwitchService
  setRetainDisabled(disabled: boolean): void
  dispose(): Promise<void>
}

const ALLOWED: ChatStartGuardResult = { ok: true }

/** Wires the guard, the switch service, the resume decorator, the chat start guard, IPC and the session events. */
export function activateChatSwitch(d: ChatSwitchMainDeps): ChatSwitchMain {
  const guard = createExternalSessionGuard()
  let retainDisabled = false
  const publishChanged = (sessionId: string, phase = SWITCH_PHASE.idle) =>
    d.ipc.publish(chatSwitchIpcEvents.changed, { sessionId, phase })
  const service = createChatSwitchService({
    agents: d.agents,
    providers: d.providers,
    guard,
    worktreePath: d.worktreePath,
    publish: (e) => d.ipc.publish(chatSwitchIpcEvents.changed, e),
    log: d.log,
    retainDisabled: () => retainDisabled,
  })
  d.provide(guard, service)

  /** A running session reported (or changed) its external id: claim it; an outside resume is reported, not killed. */
  const claimReported = (sessionId: string, providerId: string, externalSessionId: string) => {
    const r = guard.claim({ providerId, externalSessionId }, sessionId)
    if (!r.ok) d.ipc.publish(chatSwitchIpcEvents.conflict, { sessionId, ownerSessionId: r.ownerSessionId })
  }
  const onUpdated = (session: AgentSession) => {
    if (service.isSwitching(session.id)) return
    if (session.mode === SWITCH_TARGET.chat) void service.releaseServe(session.id)
    if (session.externalSessionId && isRunningStatus(session.status))
      claimReported(session.id, session.providerId, session.externalSessionId)
    publishChanged(session.id)
  }

  const disposables: (Disposable | (() => void))[] = [
    d.agents.registerLaunchDecorator(createResumeDecorator({ providers: d.providers, guard })),
    d.chat.registerStartGuard((s) =>
      guard.claim({ providerId: s.providerId, externalSessionId: s.externalSessionId }, s.sessionId).ok
        ? ALLOWED
        : { ok: false, reasonKey: switchReasonKey(SWITCH_REASON.busy) },
    ),
    d.events.on(agentSessionStatusChanged, (p) => {
      if (!p.externalSessionId || !isRunningStatus(p.status) || service.isSwitching(p.sessionId)) return
      void d.agents.getSession(p.sessionId).then((s) => {
        if (s && p.externalSessionId) claimReported(s.id, s.providerId, p.externalSessionId)
        publishChanged(p.sessionId)
      })
    }),
    d.events.on(agentSessionExited, ({ sessionId }) => {
      if (service.isSwitching(sessionId)) return
      guard.release(sessionId)
      void service.releaseServe(sessionId)
      publishChanged(sessionId)
    }),
    d.events.on(agentSessionUpdated, ({ session }) => onUpdated(session)),
    d.ipc.handle(chatSwitchIpc.eligibility, ({ sessionId }) => service.eligibility(sessionId)),
    d.ipc.handle(chatSwitchIpc.switch, ({ sessionId, target }) => service.switchTo(sessionId, target)),
  ]
  return {
    guard,
    service,
    setRetainDisabled: (disabled) => {
      retainDisabled = disabled
    },
    async dispose() {
      for (const x of disposables.splice(0)) typeof x === 'function' ? x() : x.dispose()
      await service.releaseAllServes()
    },
  }
}
