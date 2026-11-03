import {
  type Comment,
  CommentsUiServiceToken,
  commentContextOf,
  DIFF_SIDE,
  type ThreadLink,
} from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { SquareArrowOutUpRight } from '@pragma/ui/icons'
import { GitChangesTestIds as T } from '../../contract'
import { fileOpener } from '../lib/editor'
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

/** "Open in editor at this line" for a thread on the file's current text (not an old-side one). */
function editorLinks(c: Comment): ThreadLink[] {
  const open = fileOpener(c.worktreeId)
  const path = c.filePath
  if (!open || !path || c.diffSide === DIFF_SIDE.old) return []
  return [
    {
      id: 'editor',
      labelKey: 'git-changes:comments.openInEditor',
      icon: SquareArrowOutUpRight,
      testId: T.commentOpenInEditor,
      onSelect: () => open(path, c.lineStart),
    },
  ]
}

/**
 * A review thread under its line, drawn by 05's ThreadView (replies, status, actions with its own delete confirm,
 * Reply; its line label links to the editor). Edit (pending root only) reopens the comment's own composer right here (prefilled, Save/Cancel), not 05's
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
      <ThreadView
        comment={comment}
        locationLabel={label}
        links={editorLinks(comment)}
        onEdit={() => setEditing(true)}
      />
    </div>
  )
}
