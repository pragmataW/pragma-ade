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

/** Where a file row was right-clicked, relative to the tree container. */
export interface RowMenuAt {
  path: string
  x: number
  y: number
}

const anchorStyle = (at: RowMenuAt | null): CSSProperties => ({
  position: 'absolute',
  left: at?.x ?? 0,
  top: at?.y ?? 0,
  width: 0,
  height: 0,
})

/** The file row's right-click menu (a dropdown anchored at the pointer): "Open diff in editor". */
export function RowMenu(props: { at: RowMenuAt | null; onClose(): void; onOpenInEditor(path: string): void }) {
  const t = useT()
  const { at } = props
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
        <DropdownMenuItem
          data-testid={T.rowMenuOpenInEditor}
          onSelect={() => {
            if (at) props.onOpenInEditor(at.path)
          }}
        >
          <SquareArrowOutUpRight size={TREE_ICON_PX} aria-hidden />
          {t('git-changes:diff.openInEditor')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
