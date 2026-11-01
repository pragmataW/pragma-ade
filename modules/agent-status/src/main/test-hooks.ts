import { AgentSessionsServiceToken } from '@pragma/module-agents/contract'
import { PtyServiceToken } from '@pragma/module-terminal/contract'
import { defineTestHooks, type MainContext } from '@pragma/sdk/main'
import type { AgentStatusEvent, AgentStatusSettings, SessionStatusInfo } from '../contract'
import type { NotificationsPort } from './notifier'
import { getRuntime } from './runtime'
import type { TrackerTimings } from './tracker'

export type RecordedNotification = Parameters<NotificationsPort['show']>[0]

/** `globalThis.__pragmaAgentStatusTest` (only with `PRAGMA_TEST=1`). */
export interface AgentStatusTestHooks {
  writeToSession(sessionId: string, text: string): Promise<void>
  setFallbackTimings(t: Partial<TrackerTimings>): void
  useRecordingNotifications(): void
  getNotifications(): RecordedNotification[]
  clickNotification(i: number): Promise<void>
  setAppFocused(focused: boolean): void
  getStatus(sessionId: string): SessionStatusInfo | null
  reportEvent(sessionId: string, event: AgentStatusEvent): Promise<boolean>
}
export type AgentStatusTestGlobal = { __pragmaAgentStatusTest: AgentStatusTestHooks }

const runtime = () => {
  const rt = getRuntime()
  if (!rt) throw new Error('agent-status is not active')
  return rt
}

export function createAgentStatusTestHooks(ctx: MainContext): AgentStatusTestHooks {
  const settings = ctx.settings as MainContext<AgentStatusSettings>['settings']
  const recorded: RecordedNotification[] = []
  return {
    async writeToSession(sessionId, text) {
      const session = await ctx.services.get(AgentSessionsServiceToken).getSession(sessionId)
      if (!session?.ptyId) throw new Error(`session ${sessionId} has no pty`)
      ctx.services.get(PtyServiceToken).write(session.ptyId, text)
    },
    setFallbackTimings: (t) => void settings.update({ fallback: t }),
    useRecordingNotifications: () => runtime().notifier.setPort({ show: (n) => void recorded.push(n) }),
    getNotifications: () => [...recorded],
    async clickNotification(i) {
      const n = recorded[i]
      if (!n) throw new Error(`no notification ${i}`)
      await ctx.commands.execute(n.onClickCommand.id, n.onClickCommand.args)
    },
    setAppFocused: (focused) => runtime().notifier.setFocus({ isAppFocused: () => focused }),
    getStatus: (sessionId) => runtime().service.getStatus(sessionId),
    reportEvent: (sessionId, event) => runtime().service.reportEvent(sessionId, event),
  }
}

export default defineTestHooks((ctx) => {
  ;(globalThis as unknown as AgentStatusTestGlobal).__pragmaAgentStatusTest = createAgentStatusTestHooks(ctx)
})
