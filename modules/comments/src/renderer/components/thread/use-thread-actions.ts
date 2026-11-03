import { type CommentStatus, commentsIpc } from '../../../contract'
import { runtime } from '../../runtime'

const report = (what: string) => (e: unknown) => console.warn(`comments: ${what} failed`, e)

/** The IPC actions of one thread (user side); failures are logged, the next `comments.changed` reload shows truth. */
export function threadActions(id: string) {
  const ipc = () => runtime().ipc
  return {
    reply: (body: string) => ipc().invoke(commentsIpc.reply, { id, body }),
    setStatus: (status: CommentStatus) =>
      ipc().invoke(commentsIpc.setStatus, { id, status }).then(undefined, report('status change')),
    /** Rejects on failure (the thread shows an alert). */
    remove: () => ipc().invoke(commentsIpc.remove, { id }),
    removeReply: (replyId: string) => ipc().invoke(commentsIpc.removeReply, { replyId }).catch(report('reply delete')),
  }
}
export type ThreadActionsApi = ReturnType<typeof threadActions>
