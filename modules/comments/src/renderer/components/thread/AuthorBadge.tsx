import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { type CommentReply, REPLY_AUTHOR, COMMENTS_TESTIDS as T } from '../../../contract'
import { OUTLINE } from '../../lib/buttons'

/** "You" for the user, else the agent's profile label ("Agent" when unknown). */
export function AuthorBadge({ reply }: { reply: Pick<CommentReply, 'author' | 'authorLabel'> }) {
  const t = useT()
  const user = reply.author === REPLY_AUTHOR.user
  const label = user ? t('comments:thread.you') : (reply.authorLabel ?? t('comments:thread.agent'))
  return (
    <Badge data-testid={T.replyAuthor} variant={user ? OUTLINE : 'secondary'} className="px-1.5 py-0 text-[11px]">
      {label}
    </Badge>
  )
}

/** Marks an item no Send has delivered yet. */
export function PendingBadge() {
  const t = useT()
  return (
    <Badge data-testid={T.pendingBadge} variant={OUTLINE} className="border-[var(--warn)] px-1.5 py-0 text-[11px]">
      {t('comments:thread.pending')}
    </Badge>
  )
}
