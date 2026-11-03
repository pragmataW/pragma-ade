import { type Comment, CommentsUiServiceToken, commentContextOf } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { GitChangesTestIds as T } from '../../contract'
import { getRendererCtx } from '../lib/sdk'
import { useGitChangesStore, useWorktreeView } from '../store'
import { DiffCommentComposer } from './DiffCommentComposer'

/** `L3–5` / `L3` for the thread's range. */
function useLinesLabel(c: Pick<Comment, 'lineStart' | 'lineEnd'>): string | undefined {
  const t = useT()
  const { lineStart: start, lineEnd: end } = c
  if (start === undefined) return undefined
  return end === undefined || end === start
    ? t('git-changes:comments.line', { start })
    : t('git-changes:comments.lines', { start, end })
}

/**
 * A review thread under its line, drawn by 05's ThreadView (replies, status, actions with its own delete confirm,
 * Reply). Edit (pending root only) reopens the comment's own composer right here (prefilled, Save/Cancel), not 05's
 * drawer.
 */
export function CommentCard({ comment }: { comment: Comment }) {
  const label = useLinesLabel(comment)
  const editing = useWorktreeView(comment.worktreeId).editingId === comment.id
  const setEditing = (on: boolean) =>
    useGitChangesStore.getState().editComment(comment.worktreeId, on ? comment.id : null)
  const { ThreadView } = getRendererCtx().services.get(CommentsUiServiceToken)
  if (editing)
    return (
      <DiffCommentComposer
        worktreeId={comment.worktreeId}
        context={commentContextOf(comment)}
        edit={comment}
        onClose={() => setEditing(false)}
      />
    )
  return (
    <div data-testid={T.commentCard} data-comment-id={comment.id} className="mx-3 my-2">
      <ThreadView comment={comment} locationLabel={label} onEdit={() => setEditing(true)} />
    </div>
  )
}
