import { type Comment, CommentsUiServiceToken, commentContextOf } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Button } from '@pragma/ui/components/button'
import { useState } from 'react'
import { ROLE_ALERT, SIZE_XS, VARIANT_LINK } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { discardThreads } from '../lib/comments'
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

const LINK_CLASS = 'h-auto p-0 text-xs'

/** Deletes the thread through 05's IPC. Resolves false on failure. */
async function deleteThread(comment: Comment): Promise<boolean> {
  try {
    await discardThreads([comment])
    return true
  } catch (e) {
    console.warn('git-changes: delete comment failed', e)
    return false
  }
}

/** "Delete this comment?" Delete / Cancel under the thread (like the review bar's Discard). */
function DeleteConfirm({ onConfirm, onCancel }: { onConfirm(): void; onCancel(): void }) {
  const t = useT()
  return (
    <div className="mt-1 flex items-center justify-end gap-2 text-muted-foreground text-xs">
      <span>{t('git-changes:comments.confirmDelete')}</span>
      <Button
        size={SIZE_XS}
        variant={VARIANT_LINK}
        className={`${LINK_CLASS} text-[var(--err)]`}
        data-testid={T.commentDeleteConfirm}
        onClick={onConfirm}
      >
        {t('git-changes:comments.deleteConfirm')}
      </Button>
      <Button
        size={SIZE_XS}
        variant={VARIANT_LINK}
        className={LINK_CLASS}
        data-testid={T.commentDeleteCancel}
        onClick={onCancel}
      >
        {t('git-changes:comments.deleteCancel')}
      </Button>
    </div>
  )
}

/** The thread's Delete asks inline first; a failed delete shows an error on the card. */
function useDeleteFlow(comment: Comment) {
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  const confirm = async () => {
    setConfirming(false)
    setFailed(!(await deleteThread(comment)))
  }
  return { confirming, failed, ask: () => setConfirming(true), cancel: () => setConfirming(false), confirm }
}

/**
 * A review thread under its line, drawn by 05's ThreadView (replies, status, reply box). Edit (pending root only)
 * reopens the comment's own composer right here (prefilled, Save/Cancel), not 05's drawer; Delete asks inline first.
 */
export function CommentCard({ comment }: { comment: Comment }) {
  const t = useT()
  const label = useLinesLabel(comment)
  const del = useDeleteFlow(comment)
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
      <ThreadView comment={comment} locationLabel={label} onEdit={() => setEditing(true)} onDelete={del.ask} />
      {del.confirming ? <DeleteConfirm onConfirm={() => void del.confirm()} onCancel={del.cancel} /> : null}
      {del.failed ? (
        <p role={ROLE_ALERT} className="mt-1 text-[var(--err)] text-xs">
          {t('git-changes:comments.deleteFailed')}
        </p>
      ) : null}
    </div>
  )
}
