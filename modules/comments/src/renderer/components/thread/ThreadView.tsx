import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Badge } from '@pragma/ui/components/badge'
import { Button } from '@pragma/ui/components/button'
import { CircleCheck, CornerDownRight } from '@pragma/ui/icons'
import { useState } from 'react'
import {
  COMMENT_STATUS,
  COMPOSER_SURFACE,
  type Comment,
  isPendingRoot,
  REPLY_AUTHOR,
  COMMENTS_TESTIDS as T,
  type ThreadViewProps,
} from '../../../contract'
import { OUTLINE, SIZE_XS } from '../../lib/buttons'
import { AuthorLine } from './AuthorBadge'
import { ReplyBox } from './ReplyBox'
import { ReplyList } from './ReplyList'
import { ThreadActions } from './ThreadActions'
import { ThreadBody } from './ThreadBody'
import { threadActions } from './use-thread-actions'

const ICON_PX = 12

/** Open / Resolved (shape + colour: a check icon in `ok` for resolved). */
function StatusBadge({ comment }: { comment: Comment }) {
  const t = useT()
  const resolved = comment.status === COMMENT_STATUS.resolved
  return (
    <Badge
      data-testid={T.threadStatus}
      data-status={comment.status}
      variant={OUTLINE}
      className={cn('px-1.5 py-0 text-[11px]', resolved && 'border-[var(--ok)] text-[var(--ok)]')}
    >
      {resolved ? <CircleCheck size={ICON_PX} aria-hidden /> : null}
      {t(resolved ? 'comments:thread.resolved' : 'comments:thread.open')}
    </Badge>
  )
}

/** "Show thread (2 replies)" / "Hide thread" for a collapsed (resolved) thread. */
function ToggleButton({ open, count, onClick }: { open: boolean; count: number; onClick(): void }) {
  const t = useT()
  return (
    <Button
      data-testid={T.threadToggle}
      size={SIZE_XS}
      variant="link"
      className="h-auto self-start p-0 text-xs"
      onClick={onClick}
    >
      {open ? t('comments:thread.collapse') : t('comments:thread.expand', { count })}
    </Button>
  )
}

function ReplyArea({ api }: { api: ReturnType<typeof threadActions> }) {
  const t = useT()
  const [replying, setReplying] = useState(false)
  if (replying)
    return (
      <div className="ml-[7px] border-[var(--bd2)] border-l-2 pl-3">
        <ReplyBox onSubmit={api.reply} onClose={() => setReplying(false)} />
      </div>
    )
  return (
    <Button
      data-testid={T.replyOpen}
      size={SIZE_XS}
      variant="ghost"
      className="-ml-1 h-6 self-start px-1.5 text-muted-foreground text-xs hover:text-foreground"
      onClick={() => setReplying(true)}
    >
      <CornerDownRight size={ICON_PX} aria-hidden />
      {t('comments:thread.reply')}
    </Button>
  )
}

/**
 * One review thread (the same on every surface): head (host's leading icon and location, status, Pending, actions),
 * the root body, the replies with author badges, and a reply box. A resolved thread starts collapsed.
 */
export function ThreadView({ comment, leading, locationLabel, onEdit, onDelete, surface, className }: ThreadViewProps) {
  const [open, setOpen] = useState(comment.status !== COMMENT_STATUS.resolved)
  const api = threadActions(comment.id)
  const card = surface !== COMPOSER_SURFACE.plain
  return (
    <div
      data-testid={T.thread}
      data-comment-id={comment.id}
      data-status={comment.status}
      className={cn(
        'flex flex-col gap-1.5 font-sans text-[13px]',
        card && 'rounded-[var(--radius-card)] border border-[var(--bd)] bg-[var(--el)] px-3 py-2',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
        {leading}
        {locationLabel ? <span className="min-w-0 truncate font-mono">{locationLabel}</span> : null}
        <StatusBadge comment={comment} />
        <span className="ml-auto" />
        <ThreadActions comment={comment} api={api} onEdit={onEdit} onDelete={onDelete} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <AuthorLine
          author={REPLY_AUTHOR.user}
          createdAt={comment.createdAt}
          pending={isPendingRoot(comment)}
          testId={T.threadAuthor}
        />
        <ThreadBody body={comment.body} preview={!open} />
      </div>
      {open ? <ReplyList replies={comment.replies} onDiscard={api.removeReply} /> : null}
      {open ? <ReplyArea api={api} /> : null}
      {comment.status === COMMENT_STATUS.resolved ? (
        <ToggleButton open={open} count={comment.replies.length} onClick={() => setOpen(!open)} />
      ) : null}
    </div>
  )
}
