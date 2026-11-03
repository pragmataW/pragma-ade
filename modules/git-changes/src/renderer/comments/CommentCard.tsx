import { type Comment, commentContextOf } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { GitChangesTestIds as T } from '../../contract'
import { useGitChangesStore, useWorktreeView } from '../store'
import { DiffCommentComposer } from './DiffCommentComposer'

/**
 * An inline review draft under its line: range, Pending badge, body, Edit. Edit reopens the draft's own composer
 * right here (prefilled, Save/Cancel), not 05's drawer. Sent ones are deleted.
 */
export function CommentCard({ comment }: { comment: Comment }) {
  const t = useT()
  const editing = useWorktreeView(comment.worktreeId).editingId === comment.id
  const setEditing = (on: boolean) =>
    useGitChangesStore.getState().editComment(comment.worktreeId, on ? comment.id : null)
  if (editing)
    return (
      <DiffCommentComposer
        worktreeId={comment.worktreeId}
        context={commentContextOf(comment)}
        edit={comment}
        onClose={() => setEditing(false)}
      />
    )
  const { lineStart: start, lineEnd: end } = comment
  const lines =
    start === undefined
      ? null
      : end === undefined || end === start
        ? t('git-changes:comments.line', { start })
        : t('git-changes:comments.lines', { start, end })
  return (
    <div
      data-testid={T.commentCard}
      className="mx-3 my-2 rounded-[var(--radius-card)] border border-[var(--bd)] bg-[var(--el)] px-3 py-2 font-sans text-[13px]"
    >
      <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
        {lines ? <span className="font-mono">{lines}</span> : null}
        <Badge variant="secondary">{t('git-changes:comments.pending')}</Badge>
        <Button size="xs" variant="link" className="ml-auto h-auto p-0 text-xs" onClick={() => setEditing(true)}>
          {t('git-changes:comments.edit')}
        </Button>
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  )
}
