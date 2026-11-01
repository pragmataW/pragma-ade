import { agentsCommands } from '@pragma/module-agents/contract'
import { useMemo } from 'react'
import { commentsIpc, SEND_STATUS, type SendResult } from '../contract'
import { type CommentsRuntime, runtime } from './runtime'
import { useCommentsStore } from './store'

export interface SendOptions {
  preferredSessionId?: string
  /** Default: the active worktree (used for the launch suggestion). */
  worktreeId?: string
}

/** The preferred session becomes the picker's default when it is one of the candidates. */
function preferring(r: SendResult, preferredSessionId: string | undefined): SendResult {
  if (r.status !== SEND_STATUS.needsTarget || !preferredSessionId) return r
  return r.sessions.some((s) => s.id === preferredSessionId) ? { ...r, defaultSessionId: preferredSessionId } : r
}

const settled = (r: SendResult): SendResult | undefined =>
  r.status === SEND_STATUS.sent || r.status === SEND_STATUS.failed ? r : undefined

/**
 * The send flow shared by the drawer, the composer and `CommentsUiService.send`: main resolves the target and sends
 * when exactly one agent runs; otherwise the store opens the target picker or the launch suggestion.
 */
export function createSendFlow(rt: CommentsRuntime, store: typeof useCommentsStore) {
  const apply = (worktreeId: string | null, ids: string[], r: SendResult) =>
    store.getState().applyResult(worktreeId, ids, r)
  return {
    /** Resolves to the result, or undefined while a dialog waits for the user. */
    async send(commentIds: string[], opts: SendOptions = {}): Promise<SendResult | undefined> {
      const worktreeId = opts.worktreeId ?? store.getState().activeWorktreeId
      const r = preferring(await rt.ipc.invoke(commentsIpc.send, { commentIds }), opts.preferredSessionId)
      apply(worktreeId, commentIds, r)
      return settled(r)
    },
    async sendTo(commentIds: string[], sessionId: string): Promise<SendResult> {
      const r = await rt.ipc.invoke(commentsIpc.send, { commentIds, targetSessionId: sessionId })
      apply(store.getState().activeWorktreeId, commentIds, r)
      return r
    },
    /** Queues the comments for the next agent started in the worktree and opens 03's launcher. */
    async startAgentAndSend(worktreeId: string, commentIds: string[]): Promise<void> {
      await rt.ipc.invoke(commentsIpc.sendOnNextSession, { worktreeId, commentIds })
      store.getState().setLaunchWaiting()
      await rt.commands.execute(agentsCommands.openLauncher.id, { worktreeId })
    },
    async cancelLaunch(worktreeId: string): Promise<void> {
      store.getState().closeLaunchSuggestion()
      await rt.ipc.invoke(commentsIpc.cancelPending, { worktreeId })
    },
  }
}
export type SendFlow = ReturnType<typeof createSendFlow>

export function useSendFlow(): SendFlow {
  return useMemo(() => createSendFlow(runtime(), useCommentsStore), [])
}
