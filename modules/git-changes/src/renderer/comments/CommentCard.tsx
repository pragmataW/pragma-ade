import { type Comment, commentContextOf } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { Trash2 } from '@pragma/ui/icons'
import { useState } from 'react'
import { COMMENT_ICON_PX, ROLE_ALERT, SIZE_ICON_XS, SIZE_XS, VARIANT_GHOST, VARIANT_LINK } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { discardDiffDrafts } from '../lib/comments'
import { useGitChangesStore, useWorktreeView } from '../store'
import { DiffCommentComposer } from './DiffCommentComposer'

const LINK_CLASS = 'h-auto p-0 text-xs'

/** Deletes one draft through 05's IPC; closes its edit box if open. Resolves false on failure. */
async function deleteDraft(comment: Comment): Promise<boolean> {
  try {
    await discardDiffDrafts([comment.id])
  } catch (e) {
    console.warn('git-changes: delete comment failed', e)
    return false
  }
  const s = useGitChangesStore.getState()
  if (s.views[comment.worktreeId]?.editingId === comment.id) s.editComment(comment.worktreeId, null)
  return true
}

/** Edit · trash (asks inline "Delete this comment?" Delete / Cancel, like the review bar's Discard). */
function CardActions({ comment, onEdit }: { comment: Comment; onEdit(): void }) {
  const t = useT()
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  const confirm = async () => {
    setConfirming(false)
    setFailed(!(await deleteDraft(comment)))
  }
  const label = t('git-changes:comments.delete')
  if (confirming)
    return (
      <span className="ml-auto flex items-center gap-2">
        <span>{t('git-changes:comments.confirmDelete')}</span>
        <Button
          size={SIZE_XS}
          variant={VARIANT_LINK}
          className={`${LINK_CLASS} text-[var(--err)]`}
          data-testid={T.commentDeleteConfirm}
          onClick={() => void confirm()}
        >
          {t('git-changes:comments.deleteConfirm')}
        </Button>
        <Button
          size={SIZE_XS}
          variant={VARIANT_LINK}
          className={LINK_CLASS}
          data-testid={T.commentDeleteCancel}
          onClick={() => setConfirming(false)}
        >
          {t('git-changes:comments.deleteCancel')}
        </Button>
      </span>
    )
  return (
    <span className="ml-auto flex items-center gap-1">
      {failed ? (
        <span role={ROLE_ALERT} className="text-[var(--err)]">
          {t('git-changes:comments.deleteFailed')}
        </span>
      ) : null}
      <Button size={SIZE_XS} variant={VARIANT_LINK} className={LINK_CLASS} onClick={onEdit}>
        {t('git-changes:comments.edit')}
      </Button>
      <Button
        size={SIZE_ICON_XS}
        variant={VARIANT_GHOST}
        aria-label={label}
        title={label}
        data-testid={T.commentDelete}
        className="text-muted-foreground hover:text-[var(--err)]"
        onClick={() => setConfirming(true)}
      >
        <Trash2 size={COMMENT_ICON_PX} aria-hidden />
      </Button>
    </span>
  )
}

/**
 * An inline review draft under its line: range, Pending badge, body, Edit, Delete. Edit reopens the draft's own
 * composer right here (prefilled, Save/Cancel); Delete removes it after an inline confirm. Never 05's drawer. Sent
 * ones are deleted by 05.
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
        <CardActions comment={comment} onEdit={() => setEditing(true)} />
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  )
}
