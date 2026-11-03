import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { type LucideIcon, Minus, Plus, SquareArrowOutUpRight, Undo2 } from '@pragma/ui/icons'
import { BUTTON_TYPE, ROW_ACTION_ICON_PX } from '../../constants'
import { type ChangedFile, GitChangesTestIds as T } from '../../contract'
import { filesUnder, TREE_NODE_KINDS, type TreeNode } from './build-tree'

/** What the uncommitted tree's rows can do (absent in branch mode). Without files: the whole group. */
export interface RowHandlers {
  stage(files?: ChangedFile[]): void
  unstage(files?: ChangedFile[]): void
  /** `all`: the "Changes" group's Discard All. */
  discard(files: ChangedFile[], all: boolean): void
}

export const ROW_ACTIONS = ['open', 'discard', 'stage', 'unstage'] as const
export type RowAction = (typeof ROW_ACTIONS)[number]
const [OPEN, DISCARD, STAGE, UNSTAGE] = ROW_ACTIONS
const [, FILE_KIND, GROUP_KIND] = TREE_NODE_KINDS

interface RowButton {
  action: RowAction
  icon: LucideIcon
  labelKey: string
  run(): void
}

/** What a row's buttons act on: its entry (or directory), its whole group, or a filtered group's matching entries. */
const SCOPES = ['entry', 'all', 'matching'] as const
type Scope = (typeof SCOPES)[number]
const [ENTRY, ALL, MATCHING] = SCOPES

type ScmAction = Exclude<RowAction, typeof OPEN>
const LABELS: Record<ScmAction, Record<Scope, string>> = {
  stage: {
    entry: 'git-changes:scm.row.stage',
    all: 'git-changes:scm.row.stageAll',
    matching: 'git-changes:scm.row.stageMatching',
  },
  unstage: {
    entry: 'git-changes:scm.row.unstage',
    all: 'git-changes:scm.row.unstageAll',
    matching: 'git-changes:scm.row.unstageMatching',
  },
  discard: {
    entry: 'git-changes:scm.row.discard',
    all: 'git-changes:scm.row.discardAll',
    matching: 'git-changes:scm.row.discardMatching',
  },
}

/**
 * While the filter is on (`totalCount` set), a group acts only on its listed entries, by path: never on one the filter
 * hides, nor on one that appears between render and click.
 */
function scopeOf(node: TreeNode): Scope {
  if (node.kind !== GROUP_KIND) return ENTRY
  return node.totalCount === undefined ? ALL : MATCHING
}

/**
 * VS Code's inline actions: Open File, then Discard + Stage for "Changes" entries, Unstage for staged ones. A whole
 * group's buttons act on every entry of the group; a filtered group's on its listed (matching) entries by path.
 */
export function rowButtons(node: TreeNode, handlers: RowHandlers, open?: () => void): RowButton[] {
  const files = filesUnder(node)
  const scope = scopeOf(node)
  const all = scope === ALL
  const opener: RowButton[] =
    open && node.kind === FILE_KIND
      ? [{ action: OPEN, icon: SquareArrowOutUpRight, labelKey: 'git-changes:diff.openInEditor', run: open }]
      : []
  if (node.staged)
    return [
      ...opener,
      {
        action: UNSTAGE,
        icon: Minus,
        labelKey: LABELS.unstage[scope],
        run: () => (all ? handlers.unstage() : handlers.unstage(files)),
      },
    ]
  return [
    ...opener,
    { action: DISCARD, icon: Undo2, labelKey: LABELS.discard[scope], run: () => handlers.discard(files, all) },
    {
      action: STAGE,
      icon: Plus,
      labelKey: LABELS.stage[scope],
      run: () => (all ? handlers.stage() : handlers.stage(files)),
    },
  ]
}

/** The row's inline buttons: shown on hover, focus or selection; a click never selects or toggles the row. */
export function RowActions(props: { buttons: RowButton[]; visible: boolean }) {
  const t = useT()
  return (
    <span
      className={cn(
        'shrink-0 items-center gap-0.5 group-hover:flex group-focus-within:flex',
        props.visible ? 'flex' : 'hidden',
      )}
    >
      {props.buttons.map((b) => (
        <button
          key={b.action}
          type={BUTTON_TYPE}
          data-testid={T.rowAction(b.action)}
          aria-label={t(b.labelKey)}
          title={t(b.labelKey)}
          onClick={(e) => {
            e.stopPropagation()
            b.run()
          }}
          className="flex size-[18px] items-center justify-center rounded text-muted-foreground hover:bg-[var(--bd)] hover:text-[var(--tx)]"
        >
          <b.icon size={ROW_ACTION_ICON_PX} aria-hidden />
        </button>
      ))}
    </span>
  )
}
