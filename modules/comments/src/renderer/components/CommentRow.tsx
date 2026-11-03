import { useT } from '@pragma/sdk/renderer'
import { FileCode, GitCompare, MousePointerClick } from '@pragma/ui/icons'
import { useState } from 'react'
import {
  COMPOSER_SURFACE,
  type Comment,
  type CommentSource,
  commentContextOf,
  COMMENTS_TESTIDS as T,
} from '../../contract'
import { locationLabel } from '../location'
import { CommentComposer } from './CommentComposer'
import { ThreadView } from './thread/ThreadView'

const ICON_PX = 14
const SOURCE_ICONS = { editor: FileCode, diff: GitCompare, browser: MousePointerClick } as const
const SOURCE_LABEL_KEYS = {
  editor: 'comments:row.source.editor',
  diff: 'comments:row.source.diff',
  browser: 'comments:row.source.browser',
} as const satisfies Record<CommentSource, string>

function SourceIcon({ source }: { source: CommentSource }) {
  const t = useT()
  const Icon = SOURCE_ICONS[source]
  return (
    <span role="img" aria-label={t(SOURCE_LABEL_KEYS[source])} className="shrink-0 text-muted-foreground">
      <Icon size={ICON_PX} aria-hidden />
    </span>
  )
}

/** One review thread in the drawer: source icon, location, status, replies; Edit swaps in the composer (pending root). */
export function CommentRow({ comment }: { comment: Comment }) {
  const [editing, setEditing] = useState(false)
  return (
    <li data-testid={T.row} data-comment-id={comment.id} className="border-b px-4 py-2.5">
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
          surface={COMPOSER_SURFACE.plain}
          leading={<SourceIcon source={comment.source} />}
          locationLabel={locationLabel(comment)}
          onEdit={() => setEditing(true)}
        />
      )}
    </li>
  )
}
