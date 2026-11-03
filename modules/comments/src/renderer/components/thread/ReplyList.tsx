import { useT } from '@pragma/sdk/renderer'
import { X } from '@pragma/ui/icons'
import { type CommentReply, isPendingReply, COMMENTS_TESTIDS as T } from '../../../contract'
import { IconButton } from '../../lib/buttons'
import { AuthorLine } from './AuthorBadge'
import { ThreadBody } from './ThreadBody'

const ICON_PX = 12

function ReplyItem({ reply, onDiscard }: { reply: CommentReply; onDiscard(id: string): void }) {
  const t = useT()
  const pending = isPendingReply(reply)
  const discard = t('comments:thread.discardReply')
  return (
    <li data-testid={T.reply} data-reply-id={reply.id} className="group/reply flex min-w-0 flex-col gap-1">
      <div className="flex min-w-0 items-center gap-1">
        <AuthorLine
          author={reply.author}
          authorLabel={reply.authorLabel}
          createdAt={reply.createdAt}
          pending={pending}
          testId={T.replyAuthor}
        />
        {pending ? (
          <IconButton
            data-testid={T.replyDiscard}
            aria-label={discard}
            title={discard}
            className="ml-auto size-5 text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover/reply:opacity-100"
            onClick={() => onDiscard(reply.id)}
          >
            <X size={ICON_PX} aria-hidden />
          </IconButton>
        ) : null}
      </div>
      <ThreadBody body={reply.body} className="text-[12.5px]" />
    </li>
  )
}

/** The thread's replies, oldest first, on a thread line under the root; a pending user reply can be discarded. */
export function ReplyList({ replies, onDiscard }: { replies: CommentReply[]; onDiscard(id: string): void }) {
  if (!replies.length) return null
  return (
    <ul
      data-testid={T.threadReplies}
      className="ml-[7px] flex min-w-0 flex-col gap-2.5 border-[var(--bd2)] border-l-2 py-0.5 pl-3"
    >
      {replies.map((r) => (
        <ReplyItem key={r.id} reply={r} onDiscard={onDiscard} />
      ))}
    </ul>
  )
}
