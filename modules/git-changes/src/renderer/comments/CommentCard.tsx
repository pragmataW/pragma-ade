import { type Comment, CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { GitChangesTestIds as T } from '../../contract'
import { getRendererCtx } from '../lib/sdk'

/** An inline review draft under its line: range, Pending badge, body, Edit (in 05's drawer). Sent ones are deleted. */
export function CommentCard({ comment }: { comment: Comment }) {
  const t = useT()
  const { lineStart: start, lineEnd: end } = comment
  const lines =
    start === undefined
      ? null
      : end === undefined || end === start
        ? t('git-changes:comments.line', { start })
        : t('git-changes:comments.lines', { start, end })
  const edit = () =>
    getRendererCtx().services.get(CommentsUiServiceToken).openDrawer({ worktreeId: comment.worktreeId })
  return (
    <div
      data-testid={T.commentCard}
      className="mx-3 my-2 rounded-[var(--radius-card)] border border-[var(--bd)] bg-[var(--el)] px-3 py-2 font-sans text-[13px]"
    >
      <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
        {lines ? <span className="font-mono">{lines}</span> : null}
        <Badge variant="secondary">{t('git-changes:comments.pending')}</Badge>
        <Button size="xs" variant="link" className="ml-auto h-auto p-0 text-xs" onClick={edit}>
          {t('git-changes:comments.edit')}
        </Button>
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  )
}
