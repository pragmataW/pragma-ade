import { AGENTS_COMMANDS } from '@pragma/module-agents/contract'
import { PROJECTS_COMMANDS } from '@pragma/module-projects/contract'
import type { Disposable, Logger } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { type AgentStatus, type OpenSessionArgs, openSessionCommand, type SessionStatusInfo } from '../contract'
import { shouldNotify } from '../lib/status-rules'

export const NOTIFICATION_KEYS = {
  title: 'agent-status:notification.waitingTitle',
  body: 'agent-status:notification.waitingBody',
} as const

const OPEN_SESSION_TITLE_KEY = 'agent-status:commands.openSession'

export interface FocusState {
  isAppFocused(): boolean
}
export interface NotificationsPort {
  show(n: {
    titleKey: string
    bodyKey: string
    params: Record<string, string>
    onClickCommand: { id: string; args: OpenSessionArgs }
  }): void
}
export interface Notifier {
  onTransition(info: SessionStatusInfo, prev: AgentStatus): void
  setPort(port: NotificationsPort): void
  setFocus(focus: FocusState): void
}

export interface NotifierDeps {
  port: NotificationsPort
  focus: FocusState
  enabled(): boolean
  describe(sessionId: string): Promise<{ agentName: string; branch: string }>
  log?: Pick<Logger, 'warn'>
}

/** One desktop notification per entry into `waiting` while the app is in the background; a click opens the session. */
export function createNotifier(deps: NotifierDeps): Notifier {
  let port = deps.port
  let focus = deps.focus
  return {
    onTransition(info, prev) {
      if (!shouldNotify(prev, info.status, { appFocused: focus.isAppFocused(), enabled: deps.enabled() })) return
      const { sessionId, worktreeId } = info
      deps
        .describe(sessionId)
        .then(({ agentName, branch }) =>
          port.show({
            titleKey: NOTIFICATION_KEYS.title,
            bodyKey: NOTIFICATION_KEYS.body,
            params: { agent: agentName, branch },
            onClickCommand: { id: openSessionCommand.id, args: { worktreeId, sessionId } },
          }),
        )
        .catch((e: unknown) => deps.log?.warn('agent-status: notification failed', e))
    },
    setPort(p) {
      port = p
    },
    setFocus(f) {
      focus = f
    },
  }
}

/** `agent-status.openSession`: select the worktree, then focus the session tab (renderer command of 03). */
export function registerOpenSessionCommand(commands: MainContext['commands']): Disposable {
  return commands.register(
    openSessionCommand,
    async ({ worktreeId, sessionId }) => {
      await commands.execute(PROJECTS_COMMANDS.selectWorktree, { worktreeId })
      await commands.execute(AGENTS_COMMANDS.focusSession, { sessionId })
    },
    { titleKey: OPEN_SESSION_TITLE_KEY },
  )
}

/** The default ports: `ctx.notifications` and `ctx.window`. */
export const defaultNotifierPorts = (ctx: Pick<MainContext, 'notifications' | 'window'>) => ({
  port: {
    show: (n: Parameters<NotificationsPort['show']>[0]) => ctx.notifications.show(n),
  } satisfies NotificationsPort,
  focus: { isAppFocused: () => ctx.window.isFocused() } satisfies FocusState,
})
