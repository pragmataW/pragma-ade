import { useT } from '@pragma/sdk/renderer'
import { Badge } from '@pragma/ui/components/badge'
import { Monogram } from '@pragma/ui/components/monogram'
import { User } from '@pragma/ui/icons'
import { AUTHOR_MARK_PX, MONOGRAM_MAX_LETTERS } from '../../../constants'
import { type CommentReply, REPLY_AUTHOR, COMMENTS_TESTIDS as T } from '../../../contract'
import { OUTLINE } from '../../lib/buttons'
import { TimeAgo } from './TimeAgo'

const USER_ICON_PX = 11
const WORD_RE = /\s+/

/** "CC" for "Claude Code", "AG" for "Agent". */
const initials = (label: string): string => {
  const words = label.trim().split(WORD_RE).filter(Boolean)
  const letters = words.length > 1 ? words.map((w) => w[0]).join('') : label.trim()
  return letters.slice(0, MONOGRAM_MAX_LETTERS).toUpperCase()
}

/** Marks an item no Send has delivered yet. */
export function PendingBadge() {
  const t = useT()
  return (
    <Badge
      data-testid={T.pendingBadge}
      variant={OUTLINE}
      className="h-[18px] border-[var(--warn)] px-1.5 py-0 font-medium text-[10.5px] text-[var(--warn)]"
    >
      {t('comments:thread.pending')}
    </Badge>
  )
}

function UserMark() {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-[var(--radius-chip)] bg-[var(--hv)] text-muted-foreground"
      style={{ width: AUTHOR_MARK_PX, height: AUTHOR_MARK_PX }}
    >
      <User size={USER_ICON_PX} />
    </span>
  )
}

/**
 * Who wrote an item and when: a mark (user glyph, or the agent's monogram), "You" or the agent's profile label
 * ("Agent" when unknown), the relative time and Pending while unsent. In a narrow card the time and Pending wrap onto
 * a second line rather than cutting the author's name.
 */
export function AuthorLine(p: {
  author: CommentReply['author']
  authorLabel?: string
  createdAt: number
  pending: boolean
  testId: string
}) {
  const t = useT()
  const user = p.author === REPLY_AUTHOR.user
  const label = user ? t('comments:thread.you') : (p.authorLabel ?? t('comments:thread.agent'))
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
      {user ? <UserMark /> : <Monogram letters={initials(label)} size={AUTHOR_MARK_PX} />}
      <span data-testid={p.testId} className="min-w-0 max-w-full truncate font-semibold text-[12px] text-foreground">
        {label}
      </span>
      <TimeAgo ts={p.createdAt} />
      {p.pending ? <PendingBadge /> : null}
    </div>
  )
}
