import { useT } from '@pragma/sdk/renderer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { SquareArrowOutUpRight } from '@pragma/ui/icons'
import type { CSSProperties } from 'react'
import { TREE_ICON_PX } from '../../constants'
import { GitChangesTestIds as T } from '../../contract'
import type { TreeNode } from './build-tree'
import { ROW_ACTIONS, type RowHandlers, rowButtons } from './RowActions'

/** Which file row was right-clicked, and where (relative to the tree container). */
export interface RowMenuAt {
  node: TreeNode
  x: number
  y: number
}

const [OPEN] = ROW_ACTIONS

const anchorStyle = (at: RowMenuAt | null): CSSProperties => ({
  position: 'absolute',
  left: at?.x ?? 0,
  top: at?.y ?? 0,
  width: 0,
  height: 0,
})

/**
 * The file row's right-click menu (a dropdown anchored at the pointer): "Open diff in editor" (with the editor
 * module), then the row's Source Control actions (uncommitted mode).
 */
export function RowMenu(props: {
  at: RowMenuAt | null
  onClose(): void
  onOpenInEditor?(path: string): void
  handlers?: RowHandlers
}) {
  const t = useT()
  const { at, onOpenInEditor, handlers } = props
  const scm = at && handlers ? rowButtons(at.node, handlers).filter((b) => b.action !== OPEN) : []
  return (
    <DropdownMenu
      open={at !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose()
      }}
    >
      <DropdownMenuTrigger asChild>
        <span aria-hidden style={anchorStyle(at)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" data-testid={T.rowMenu}>
        {onOpenInEditor ? (
          <DropdownMenuItem
            data-testid={T.rowMenuOpenInEditor}
            onSelect={() => {
              if (at) onOpenInEditor(at.node.path)
            }}
          >
            <SquareArrowOutUpRight size={TREE_ICON_PX} aria-hidden />
            {t('git-changes:diff.openInEditor')}
          </DropdownMenuItem>
        ) : null}
        {scm.map((b) => (
          <DropdownMenuItem key={b.action} data-testid={T.rowMenuItem(b.action)} onSelect={b.run}>
            <b.icon size={TREE_ICON_PX} aria-hidden />
            {t(b.labelKey)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
