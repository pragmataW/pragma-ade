import type { MainContext } from '@pragma/sdk/main'
import { type CommentsService, commentsIpc as I } from '../contract'

/** Every `comments.*` channel; inputs are validated by the router against the contract schemas. */
export function registerCommentsIpc(ipc: Pick<MainContext['ipc'], 'handle'>, service: CommentsService): void {
  ipc.handle(I.addDraft, (input) => service.addDraft(input))
  ipc.handle(I.update, ({ id, patch }) => service.update(id, patch))
  ipc.handle(I.remove, ({ id }) => service.remove(id))
  ipc.handle(I.listDrafts, ({ worktreeId }) => service.listDrafts(worktreeId))
  ipc.handle(I.resolveTarget, ({ worktreeId, preferredSessionId }) =>
    service.resolveTarget(worktreeId, preferredSessionId),
  )
  // The renderer runs its own picker / launch suggestion, so main never publishes `sendRequested` for it.
  ipc.handle(I.send, ({ commentIds, targetSessionId }) =>
    service.send(commentIds, targetSessionId, { promptUser: false }),
  )
  ipc.handle(I.sendOnNextSession, ({ worktreeId, commentIds }) => service.sendOnNextSession(worktreeId, commentIds))
  ipc.handle(I.cancelPending, ({ worktreeId }) => service.cancelPending(worktreeId))
}
