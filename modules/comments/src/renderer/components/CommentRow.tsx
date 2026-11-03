import { useT } from '@pragma/sdk/renderer'
import { FileCode, GitCompare, MousePointerClick, Pencil, Trash2 } from '@pragma/ui/icons'
import { useState } from 'react'
import { type Comment, type CommentSource, commentContextOf, commentsIpc, COMMENTS_TESTIDS as T } from '../../contract'
import { IconButton } from '../lib/buttons'
import { locationLabel } from '../location'
import { runtime } from '../runtime'
import { CommentComposer } from './CommentComposer'

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
    <span role="img" aria-label={t(SOURCE_LABEL_KEYS[source])} className="mt-0.5 text-muted-foreground">
      <Icon size={ICON_PX} aria-hidden />
    </span>
  )
}

const ACTION_CLASS = 'text-muted-foreground hover:text-foreground'

/** Always-visible Edit / Delete icon buttons (tooltip = aria-label; Tab-reachable, Enter/Space activate). */
function RowActions({ comment, onEdit }: { comment: Comment; onEdit(): void }) {
  const t = useT()
  const remove = () =>
    runtime()
      .ipc.invoke(commentsIpc.remove, { id: comment.id })
      .catch((e: unknown) => console.warn('comments: delete failed', e))
  const [edit, del] = [t('comments:row.edit'), t('comments:row.delete')]
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <IconButton data-testid={T.rowEdit} aria-label={edit} title={edit} className={ACTION_CLASS} onClick={onEdit}>
        <Pencil size={ICON_PX} aria-hidden />
      </IconButton>
      <IconButton
        data-testid={T.rowDelete}
        aria-label={del}
        title={del}
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => void remove()}
      >
        <Trash2 size={ICON_PX} aria-hidden />
      </IconButton>
    </div>
  )
}

/** One thread root: source icon, location, two-line body preview, Edit/Delete. */
export function CommentRow({ comment }: { comment: Comment }) {
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <li data-testid={T.row} data-comment-id={comment.id} className="border-b px-4 py-3">
        <CommentComposer
          worktreeId={comment.worktreeId}
          context={commentContextOf(comment)}
          editCommentId={comment.id}
          initialBody={comment.body}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  return (
    <li data-testid={T.row} data-comment-id={comment.id} className="flex items-start gap-2 border-b px-4 py-2.5">
      <SourceIcon source={comment.source} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px]">{locationLabel(comment)}</div>
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-[12.5px] text-muted-foreground">
          {comment.body}
        </p>
      </div>
      <RowActions comment={comment} onEdit={() => setEditing(true)} />
    </li>
  )
}
