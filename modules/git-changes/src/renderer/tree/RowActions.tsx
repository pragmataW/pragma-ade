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

/** VS Code's inline actions: Open File, then Discard + Stage for "Changes" entries, Unstage for staged ones. */
export function rowButtons(node: TreeNode, handlers: RowHandlers, open?: () => void): RowButton[] {
  const group = node.kind === GROUP_KIND
  const files = filesUnder(node)
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
        labelKey: group ? 'git-changes:scm.row.unstageAll' : 'git-changes:scm.row.unstage',
        run: () => (group ? handlers.unstage() : handlers.unstage(files)),
      },
    ]
  return [
    ...opener,
    {
      action: DISCARD,
      icon: Undo2,
      labelKey: group ? 'git-changes:scm.row.discardAll' : 'git-changes:scm.row.discard',
      run: () => handlers.discard(files, group),
    },
    {
      action: STAGE,
      icon: Plus,
      labelKey: group ? 'git-changes:scm.row.stageAll' : 'git-changes:scm.row.stage',
      run: () => (group ? handlers.stage() : handlers.stage(files)),
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
