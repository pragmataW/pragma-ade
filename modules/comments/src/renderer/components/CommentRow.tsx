import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { FileCode, GitCompare, MousePointerClick, Pencil, Trash2 } from '@pragma/ui/icons'
import { type ReactNode, useState } from 'react'
import {
  type Comment,
  type CommentContext,
  type CommentSource,
  commentsIpc,
  COMMENTS_TESTIDS as T,
} from '../../contract'
import { IconButton } from '../lib/buttons'
import { locationLabel } from '../location'
import { runtime } from '../runtime'
import { useCommentsStore } from '../store'
import { CommentComposer } from './CommentComposer'

const ICON_PX = 14
const SOURCE_ICONS = { editor: FileCode, diff: GitCompare, browser: MousePointerClick } as const
const SOURCE_LABEL_KEYS = {
  editor: 'comments:row.source.editor',
  diff: 'comments:row.source.diff',
  browser: 'comments:row.source.browser',
} as const satisfies Record<CommentSource, string>

const contextOf = (c: Comment): CommentContext => {
  const { source, filePath, lineStart, lineEnd, diffSide, snippet, language, element } = c
  return { source, filePath, lineStart, lineEnd, diffSide, snippet, language, element }
}

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

/** One comment: checkbox (drafts), source icon, location, two-line body preview, Edit/Delete or a footer line. */
export function CommentRow({
  comment,
  selectable,
  footer,
}: {
  comment: Comment
  selectable: boolean
  footer?: ReactNode
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const selected = useCommentsStore((s) => s.selection.has(comment.id))
  const toggle = () => useCommentsStore.getState().toggleSelected(comment.id)
  if (editing)
    return (
      <li data-testid={T.row} data-comment-id={comment.id} className="border-b px-4 py-3">
        <CommentComposer
          worktreeId={comment.worktreeId}
          context={contextOf(comment)}
          editCommentId={comment.id}
          initialBody={comment.body}
          onDone={() => setEditing(false)}
        />
      </li>
    )
  return (
    <li
      data-testid={T.row}
      data-comment-id={comment.id}
      className={cn('flex items-start gap-2 border-b px-4 py-2.5', selected && 'bg-accent/40')}
    >
      {selectable ? (
        <input
          type="checkbox"
          data-testid={T.rowSelect}
          aria-label={t('comments:row.select')}
          className="mt-1 accent-primary"
          checked={selected}
          onChange={toggle}
        />
      ) : null}
      <SourceIcon source={comment.source} />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12px]">{locationLabel(comment)}</div>
        <p className="line-clamp-2 whitespace-pre-wrap break-words text-[12.5px] text-muted-foreground">
          {comment.body}
        </p>
        {footer ? <div className="mt-1 text-[11px] text-muted-foreground">{footer}</div> : null}
      </div>
      {selectable ? <RowActions comment={comment} onEdit={() => setEditing(true)} /> : null}
    </li>
  )
}
