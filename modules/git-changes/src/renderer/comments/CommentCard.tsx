import { type Comment, CommentsUiServiceToken } from '@pragma/module-comments/contract'
import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { VARIANT_OUTLINE } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import { isDraft } from '../lib/comments'
import { getRendererCtx } from '../lib/sdk'

const DRAFTS_TAB = 'drafts'

/** An inline review comment under its line: range, Pending/Sent badge, body, Edit (drafts, in 05's drawer). */
export function CommentCard({ comment }: { comment: Comment }) {
  const t = useT()
  const draft = isDraft(comment)
  const { lineStart: start, lineEnd: end } = comment
  const lines =
    start === undefined
      ? null
      : end === undefined || end === start
        ? t('git-changes:comments.line', { start })
        : t('git-changes:comments.lines', { start, end })
  const edit = () =>
    getRendererCtx()
      .services.get(CommentsUiServiceToken)
      .openDrawer({ worktreeId: comment.worktreeId, tab: DRAFTS_TAB })
  return (
    <div
      data-testid={T.commentCard}
      data-status={comment.status}
      className="mx-3 my-2 rounded-[var(--radius-card)] border border-[var(--bd)] bg-[var(--el)] px-3 py-2 font-sans text-[13px]"
    >
      <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs">
        {lines ? <span className="font-mono">{lines}</span> : null}
        <Badge variant={draft ? 'secondary' : VARIANT_OUTLINE}>
          {t(draft ? 'git-changes:comments.pending' : 'git-changes:comments.sent')}
        </Badge>
        {draft ? (
          <Button size="xs" variant="link" className="ml-auto h-auto p-0 text-xs" onClick={edit}>
            {t('git-changes:comments.edit')}
          </Button>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words">{comment.body}</p>
    </div>
  )
}
