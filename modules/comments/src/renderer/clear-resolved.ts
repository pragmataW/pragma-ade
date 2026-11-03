import { COMMENT_STATUS, commentsIpc } from '../contract'
import { type CommentsRuntime, runtime } from './runtime'

/** Confirms through the SDK dialog, then deletes the worktree's resolved threads; 0 when none or cancelled. */
export async function clearResolved(worktreeId: string, rt: CommentsRuntime = runtime()): Promise<number> {
  const { threads } = await rt.ipc.invoke(commentsIpc.list, { worktreeId, status: COMMENT_STATUS.resolved })
  const count = threads.length
  if (!count) return 0
  const ok = await rt.dialogs.confirm({
    destructive: true,
    titleKey: 'comments:clearResolved.title',
    messageKey: 'comments:clearResolved.message',
    confirmKey: 'comments:clearResolved.confirm',
    params: { count },
  })
  if (!ok) return 0
  return (await rt.ipc.invoke(commentsIpc.clearResolved, { worktreeId })).count
}
