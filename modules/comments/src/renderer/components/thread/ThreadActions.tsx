import { useT } from '@pragma/sdk/renderer'
import { CircleCheck, Pencil, RotateCcw, Trash2 } from '@pragma/ui/icons'
import type { ComponentType } from 'react'
import { COMMENT_STATUS, type Comment, isPendingRoot, COMMENTS_TESTIDS as T } from '../../../contract'
import { IconButton } from '../../lib/buttons'
import type { ThreadActionsApi } from './use-thread-actions'

const ICON_PX = 14
const QUIET = 'text-muted-foreground hover:text-foreground'

interface ActionSpec {
  testId: string
  labelKey: string
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  onClick(): void
  className?: string
}

function Action({ spec }: { spec: ActionSpec }) {
  const t = useT()
  const label = t(spec.labelKey)
  const { Icon } = spec
  return (
    <IconButton
      data-testid={spec.testId}
      aria-label={label}
      title={label}
      className={spec.className ?? QUIET}
      onClick={spec.onClick}
    >
      <Icon size={ICON_PX} aria-hidden />
    </IconButton>
  )
}

/** Edit (pending root only, when the host offers it), Resolve / Reopen, Delete thread. */
export function ThreadActions(p: {
  comment: Comment
  api: ThreadActionsApi
  onEdit?: () => void
  onDelete?: () => void
}) {
  const resolved = p.comment.status === COMMENT_STATUS.resolved
  const specs: ActionSpec[] = [
    ...(p.onEdit && isPendingRoot(p.comment)
      ? [{ testId: T.rowEdit, labelKey: 'comments:row.edit', Icon: Pencil, onClick: p.onEdit }]
      : []),
    resolved
      ? {
          testId: T.reopen,
          labelKey: 'comments:thread.reopen',
          Icon: RotateCcw,
          onClick: () => void p.api.setStatus(COMMENT_STATUS.open),
        }
      : {
          testId: T.resolve,
          labelKey: 'comments:thread.resolve',
          Icon: CircleCheck,
          onClick: () => void p.api.setStatus(COMMENT_STATUS.resolved),
          className: 'text-muted-foreground hover:text-[var(--ok)]',
        },
    {
      testId: T.rowDelete,
      labelKey: 'comments:row.delete',
      Icon: Trash2,
      onClick: p.onDelete ?? (() => void p.api.remove()),
      className: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
    },
  ]
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {specs.map((s) => (
        <Action key={s.testId} spec={s} />
      ))}
    </div>
  )
}
