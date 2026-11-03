import type { MainContext } from '@pragma/sdk/main'
import { type CommentsService, commentsIpc as I, REPLY_AUTHOR } from '../contract'

/** Every `comments.*` channel; inputs are validated by the router against the contract schemas. */
export function registerCommentsIpc(ipc: Pick<MainContext['ipc'], 'handle'>, service: CommentsService): void {
  ipc.handle(I.addDraft, (input) => service.addDraft(input))
  ipc.handle(I.update, ({ id, patch }) => service.update(id, patch))
  ipc.handle(I.remove, ({ id }) => service.remove(id))
  ipc.handle(I.list, async ({ worktreeId, status }) => ({
    threads: await service.listThreads(worktreeId, { status }),
    round: await service.round(worktreeId),
  }))
  ipc.handle(I.reply, ({ id, body }) => service.reply(id, { author: REPLY_AUTHOR.user, body }))
  ipc.handle(I.removeReply, ({ replyId }) => service.removeReply(replyId))
  ipc.handle(I.setStatus, ({ id, status }) => service.setStatus(id, status))
  ipc.handle(I.clearResolved, async ({ worktreeId }) => ({ count: await service.clearResolved(worktreeId) }))
  ipc.handle(I.resolveTarget, ({ worktreeId, preferredSessionId }) =>
    service.resolveTarget(worktreeId, preferredSessionId),
  )
  // The renderer runs its own picker / launch suggestion, so main never publishes `sendRequested` for it.
  ipc.handle(I.send, ({ worktreeId, targetSessionId }) =>
    service.send(worktreeId, targetSessionId, { promptUser: false }),
  )
  ipc.handle(I.sendOnNextSession, ({ worktreeId }) => service.sendOnNextSession(worktreeId))
  ipc.handle(I.cancelPending, ({ worktreeId }) => service.cancelPending(worktreeId))
}
