import { useT } from '@pragma/sdk/renderer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { CircleCheck, Ellipsis, Pencil, RotateCcw, Trash2 } from '@pragma/ui/icons'
import type { ComponentType } from 'react'
import { COMMENT_STATUS, type Comment, isPendingRoot, COMMENTS_TESTIDS as T, type ThreadLink } from '../../../contract'
import { IconButton } from '../../lib/buttons'
import type { ThreadActionsApi } from './use-thread-actions'

const ICON_PX = 14
const MENU_ICON_PX = 14
const QUIET = 'text-muted-foreground hover:text-foreground'
const DANGER = 'danger'
const ALIGN_END = 'end'
const DESTRUCTIVE = 'destructive'

interface ActionSpec {
  testId: string
  label: string
  Icon: ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  onClick(): void
  className?: string
  tone?: typeof DANGER
}

function InlineAction({ spec }: { spec: ActionSpec }) {
  const { Icon } = spec
  return (
    <IconButton
      data-testid={spec.testId}
      aria-label={spec.label}
      title={spec.label}
      className={spec.className ?? QUIET}
      onClick={spec.onClick}
    >
      <Icon size={ICON_PX} aria-hidden />
    </IconButton>
  )
}

function MenuAction({ spec }: { spec: ActionSpec }) {
  const { Icon } = spec
  return (
    <DropdownMenuItem
      data-testid={spec.testId}
      variant={spec.tone === DANGER ? DESTRUCTIVE : undefined}
      onSelect={spec.onClick}
      className="text-[12.5px]"
    >
      <Icon size={MENU_ICON_PX} aria-hidden />
      {spec.label}
    </DropdownMenuItem>
  )
}

/** The narrow layout's "…": the secondary actions as a menu, Delete last after a separator. */
function MoreMenu({ specs }: { specs: ActionSpec[] }) {
  const t = useT()
  const label = t('comments:thread.more')
  const head = specs.filter((s) => s.tone !== DANGER)
  const danger = specs.filter((s) => s.tone === DANGER)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton data-testid={T.threadMore} aria-label={label} title={label} className={QUIET}>
          <Ellipsis size={ICON_PX} aria-hidden />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={ALIGN_END} className="min-w-44">
        {head.map((s) => (
          <MenuAction key={s.testId} spec={s} />
        ))}
        {head.length && danger.length ? <DropdownMenuSeparator /> : null}
        {danger.map((s) => (
          <MenuAction key={s.testId} spec={s} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export interface ThreadActionsProps {
  comment: Comment
  api: ThreadActionsApi
  /** Secondary actions go into the "…" menu. */
  narrow: boolean
  links?: readonly ThreadLink[]
  onEdit?: () => void
  /** Delete (the thread's inline confirm, or the host's own flow). */
  onDelete(): void
}

function statusSpec(p: ThreadActionsProps, t: (k: string) => string): ActionSpec {
  if (p.comment.status === COMMENT_STATUS.resolved)
    return {
      testId: T.reopen,
      label: t('comments:thread.reopen'),
      Icon: RotateCcw,
      onClick: () => void p.api.setStatus(COMMENT_STATUS.open),
    }
  return {
    testId: T.resolve,
    label: t('comments:thread.resolve'),
    Icon: CircleCheck,
    onClick: () => void p.api.setStatus(COMMENT_STATUS.resolved),
    className: 'text-muted-foreground hover:text-[var(--ok)]',
  }
}

/** Edit (pending root, host flow), the host's links, then Delete. */
function secondarySpecs(p: ThreadActionsProps, t: (k: string) => string): ActionSpec[] {
  const edit: ActionSpec[] =
    p.onEdit && isPendingRoot(p.comment)
      ? [{ testId: T.rowEdit, label: t('comments:row.edit'), Icon: Pencil, onClick: p.onEdit }]
      : []
  const links: ActionSpec[] = (p.links ?? []).map((l) => ({
    testId: l.testId,
    label: t(l.labelKey),
    Icon: l.icon,
    onClick: l.onSelect,
  }))
  const del: ActionSpec = {
    testId: T.rowDelete,
    label: t('comments:row.delete'),
    Icon: Trash2,
    onClick: p.onDelete,
    className: 'text-muted-foreground hover:bg-destructive/10 hover:text-destructive',
    tone: DANGER,
  }
  return [...edit, ...links, del]
}

/**
 * One action set per thread: Resolve / Reopen always inline; Edit, the host's links and Delete inline when there is
 * room, else in a "…" menu.
 */
export function ThreadActions(p: ThreadActionsProps) {
  const t = useT()
  const secondary = secondarySpecs(p, t)
  return (
    <div data-testid={T.threadActions} className="flex shrink-0 items-center gap-0.5">
      <InlineAction spec={statusSpec(p, t)} />
      {p.narrow ? <MoreMenu specs={secondary} /> : secondary.map((s) => <InlineAction key={s.testId} spec={s} />)}
    </div>
  )
}
