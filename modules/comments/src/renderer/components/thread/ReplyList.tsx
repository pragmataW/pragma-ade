import { useT } from '@pragma/sdk/renderer'
import { X } from '@pragma/ui/icons'
import { type CommentReply, isPendingReply, COMMENTS_TESTIDS as T } from '../../../contract'
import { IconButton } from '../../lib/buttons'
import { AuthorBadge, PendingBadge } from './AuthorBadge'

const ICON_PX = 12

function ReplyItem({ reply, onDiscard }: { reply: CommentReply; onDiscard(id: string): void }) {
  const t = useT()
  const pending = isPendingReply(reply)
  const discard = t('comments:thread.discardReply')
  return (
    <li
      data-testid={T.reply}
      data-reply-id={reply.id}
      className="flex flex-col gap-1 border-[var(--bd)] border-l-2 pl-2"
    >
      <div className="flex items-center gap-1.5">
        <AuthorBadge reply={reply} />
        {pending ? <PendingBadge /> : null}
        {pending ? (
          <IconButton
            data-testid={T.replyDiscard}
            aria-label={discard}
            title={discard}
            className="ml-auto size-5 text-muted-foreground hover:text-destructive"
            onClick={() => onDiscard(reply.id)}
          >
            <X size={ICON_PX} aria-hidden />
          </IconButton>
        ) : null}
      </div>
      <p className="whitespace-pre-wrap break-words text-[12.5px]">{reply.body}</p>
    </li>
  )
}

/** The thread's replies, oldest first; a pending user reply can be discarded. */
export function ReplyList({ replies, onDiscard }: { replies: CommentReply[]; onDiscard(id: string): void }) {
  if (!replies.length) return null
  return (
    <ul className="flex flex-col gap-2">
      {replies.map((r) => (
        <ReplyItem key={r.id} reply={r} onDiscard={onDiscard} />
      ))}
    </ul>
  )
}
