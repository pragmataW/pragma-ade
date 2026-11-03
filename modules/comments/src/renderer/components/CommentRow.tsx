import { useT } from '@pragma/sdk/renderer'
import { FileCode, GitCompare, MousePointerClick } from '@pragma/ui/icons'
import { useState } from 'react'
import {
  COMMENT_SOURCE,
  type Comment,
  type CommentSource,
  commentContextOf,
  COMMENTS_TESTIDS as T,
} from '../../contract'
import { useThreadLinks } from '../use-thread-links'
import { CommentComposer } from './CommentComposer'
import { ThreadView } from './thread/ThreadView'

const ICON_PX = 13
const SOURCE_ICONS = { editor: FileCode, diff: GitCompare, browser: MousePointerClick } as const
const SOURCE_LABEL_KEYS = {
  editor: 'comments:row.source.editor',
  diff: 'comments:row.source.diff',
  browser: 'comments:row.source.browser',
} as const satisfies Record<CommentSource, string>

function SourceIcon({ source }: { source: CommentSource }) {
  const t = useT()
  const Icon = SOURCE_ICONS[source]
  const label = t(SOURCE_LABEL_KEYS[source])
  return (
    <span role="img" aria-label={label} title={label} className="shrink-0 text-muted-foreground">
      <Icon size={ICON_PX} aria-hidden />
    </span>
  )
}

/** Inside a file group the card names only its lines (`L3–5`); a browser card its element's selector. */
function useCardLocation(c: Comment): string | undefined {
  const t = useT()
  if (c.source === COMMENT_SOURCE.browser) return c.element?.selector
  const { lineStart: start, lineEnd: end } = c
  if (start === undefined) return undefined
  return end === undefined || end === start
    ? t('comments:row.line', { start })
    : t('comments:row.lines', { start, end })
}

/** One review thread card in the drawer: source icon, lines, status, replies, links; Edit swaps in the composer. */
export function CommentRow({ comment }: { comment: Comment }) {
  const [editing, setEditing] = useState(false)
  const links = useThreadLinks(comment)
  const location = useCardLocation(comment)
  return (
    <li data-testid={T.row} data-comment-id={comment.id} className="min-w-0">
      {editing ? (
        <CommentComposer
          worktreeId={comment.worktreeId}
          context={commentContextOf(comment)}
          editCommentId={comment.id}
          initialBody={comment.body}
          onDone={() => setEditing(false)}
        />
      ) : (
        <ThreadView
          comment={comment}
          links={links}
          leading={<SourceIcon source={comment.source} />}
          locationLabel={location}
          onEdit={() => setEditing(true)}
        />
      )}
    </li>
  )
}
