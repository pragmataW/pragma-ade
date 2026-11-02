import { AGENTS_COMMANDS } from '@pragma/module-agents/contract'
import type { NotificationInput } from '@pragma/sdk'
import type { CliHandoffResult } from '../contract'

export type NotificationRequest = NotificationInput

export interface Notifier {
  notifyHandoff(result: CliHandoffResult): void
}

/** Wraps `ctx.notifications.show`; `record` (test mode) gets every request too. */
export function createNotifier(deps: {
  show: (n: NotificationRequest) => void
  record?: (n: NotificationRequest) => void
}): Notifier {
  return {
    notifyHandoff({ session, worktree }) {
      const n: NotificationRequest = {
        titleKey: 'cli-integration:notifications.handoff.title',
        bodyKey: 'cli-integration:notifications.handoff.body',
        params: { profile: session.profileName ?? '', branch: worktree.branch ?? worktree.path },
        onClickCommand: { id: AGENTS_COMMANDS.focusSession, args: { sessionId: session.id } },
      }
      deps.show(n)
      deps.record?.(n)
    },
  }
}
