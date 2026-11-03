import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import { CircleCheck, CornerDownRight } from '@pragma/ui/icons'
import { type ReactNode, useState } from 'react'
import { BUTTON_TYPE, THREAD_NARROW_PX } from '../../../constants'
import {
  COMMENT_STATUS,
  COMPOSER_SURFACE,
  type Comment,
  isPendingRoot,
  REPLY_AUTHOR,
  COMMENTS_TESTIDS as T,
  type ThreadLink,
  type ThreadViewProps,
} from '../../../contract'
import { GHOST, SIZE_XS } from '../../lib/buttons'
import { useNarrow } from '../../lib/use-narrow'
import { AuthorLine } from './AuthorBadge'
import { DeleteConfirm, DeleteFailed } from './DeleteConfirm'
import { ReplyBox } from './ReplyBox'
import { ReplyList } from './ReplyList'
import { ThreadActions } from './ThreadActions'
import { ThreadBody } from './ThreadBody'
import { type ThreadActionsApi, threadActions } from './use-thread-actions'

const ICON_PX = 12
const CHIP_ICON_PX = 10
const CHIP =
  'inline-flex h-[18px] shrink-0 items-center gap-1 rounded-[var(--radius-chip)] border px-1.5 text-[10.5px] font-medium leading-none'

/** Open / Resolved (shape + colour: a check icon in `ok` for resolved). */
function StatusChip({ comment }: { comment: Comment }) {
  const t = useT()
  const resolved = comment.status === COMMENT_STATUS.resolved
  return (
    <span
      data-testid={T.threadStatus}
      data-status={comment.status}
      className={cn(
        CHIP,
        resolved ? 'border-[var(--ok)]/50 text-[var(--ok)]' : 'border-[var(--bd2)] text-muted-foreground',
      )}
    >
      {resolved ? <CircleCheck size={CHIP_ICON_PX} aria-hidden /> : null}
      {t(resolved ? 'comments:thread.resolved' : 'comments:thread.open')}
    </span>
  )
}

/** The review round that delivered the root (none while pending). */
function RoundChip({ round }: { round?: number }) {
  const t = useT()
  if (round === undefined) return null
  return (
    <span
      data-testid={T.threadRound}
      title={t('comments:thread.roundTitle', { round })}
      className={cn(CHIP, 'border-transparent bg-[var(--hv)] font-mono text-muted-foreground')}
    >
      {t('comments:thread.round', { round })}
    </span>
  )
}

/** The location; with a link it is a button that follows the first link. */
function Location({ label, link }: { label?: string; link?: ThreadLink }) {
  const t = useT()
  if (!label) return null
  const text = 'min-w-0 truncate font-mono text-[12px]'
  if (!link) return <span className={cn(text, 'text-muted-foreground')}>{label}</span>
  return (
    <button
      type={BUTTON_TYPE}
      data-testid={T.threadLocationLink}
      title={t(link.labelKey)}
      onClick={link.onSelect}
      className={cn(
        text,
        'rounded-[4px] text-left text-[var(--act)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
      )}
    >
      {label}
    </button>
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

function ReplyArea({ api }: { api: ThreadActionsApi }) {
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
      variant={GHOST}
      className="-ml-1 h-6 self-start px-1.5 text-muted-foreground text-xs hover:text-foreground"
      onClick={() => setReplying(true)}
    >
      <CornerDownRight size={ICON_PX} aria-hidden />
      {t('comments:thread.reply')}
    </Button>
  )
}

/** The thread's own Delete: ask inline, then delete; a failure shows an alert. */
function useDeleteFlow(api: ThreadActionsApi) {
  const [confirming, setConfirming] = useState(false)
  const [failed, setFailed] = useState(false)
  const confirm = () => {
    setConfirming(false)
    api.remove().then(
      () => setFailed(false),
      (e: unknown) => {
        console.warn('comments: delete failed', e)
        setFailed(true)
      },
    )
  }
  return { confirming, failed, ask: () => setConfirming(true), cancel: () => setConfirming(false), confirm }
}

function Header(p: ThreadViewProps & { narrow: boolean; api: ThreadActionsApi; onDelete(): void }): ReactNode {
  const { comment } = p
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
      <div className="flex min-w-0 flex-1 basis-24 items-center gap-1.5">
        {p.leading}
        <Location label={p.locationLabel} link={p.links?.[0]} />
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <StatusChip comment={comment} />
        <RoundChip round={comment.round} />
        <ThreadActions
          comment={comment}
          api={p.api}
          narrow={p.narrow}
          links={p.links}
          onEdit={p.onEdit}
          onDelete={p.onDelete}
        />
      </div>
    </div>
  )
}

/**
 * One review thread (the same on every surface): a header (host's leading icon and location, status and round chips,
 * one responsive action set), the root with its author line, the replies on a thread line, and a Reply button that
 * opens the reply box. A resolved thread starts collapsed.
 */
export function ThreadView(props: ThreadViewProps) {
  const { comment, surface, className } = props
  const [open, setOpen] = useState(comment.status !== COMMENT_STATUS.resolved)
  const [ref, narrow] = useNarrow<HTMLDivElement>(THREAD_NARROW_PX)
  const api = threadActions(comment.id)
  const del = useDeleteFlow(api)
  const card = surface !== COMPOSER_SURFACE.plain
  return (
    <div
      ref={ref}
      data-testid={T.thread}
      data-comment-id={comment.id}
      data-status={comment.status}
      data-narrow={narrow || undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 font-sans text-[13px]',
        card && 'rounded-[var(--radius-card)] border border-[var(--bd)] bg-[var(--el)] px-3 py-2.5',
        className,
      )}
    >
      <Header {...props} narrow={narrow} api={api} onDelete={props.onDelete ?? del.ask} />
      {del.confirming ? <DeleteConfirm onConfirm={del.confirm} onCancel={del.cancel} /> : null}
      {del.failed ? <DeleteFailed /> : null}
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
