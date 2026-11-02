import { useDraggable } from '@dnd-kit/core'
import { CoreCommands, ShellTestIds as T } from '@pragma/sdk'
import { useRendererHost, useT } from '@pragma/sdk/renderer'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { Icon } from '@pragma/ui/components/icon'
import { DOCK_POSITIONS, type DockPosition } from '../lib/dock-layout'
import { MOVE_DOCK_COMMANDS } from '../lib/shell-commands'
import { useShell } from '../lib/shell-context'
import { IconButton } from './IconButton'
import { PlainButton } from './PlainButton'

export const DOCK_DRAG_ID = 'dock'

export const POSITION_LABEL: Record<DockPosition, string> = {
  left: 'core:dock.position.left',
  right: 'core:dock.position.right',
  top: 'core:dock.position.top',
  bottom: 'core:dock.position.bottom',
}

/** Grip that drags the whole dock to another edge (drop zones: `DockDropOverlay`). */
function DockDragHandle() {
  const t = useT()
  const { setNodeRef, listeners, attributes } = useDraggable({ id: DOCK_DRAG_ID })
  return (
    <PlainButton
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      data-testid={T.dockDragHandle}
      aria-label={t('core:dock.drag')}
      title={t('core:dock.drag')}
      className="flex h-6 w-5 cursor-grab items-center justify-center rounded-[var(--radius-button)] text-[var(--mu)] hover:bg-[var(--hv)] hover:text-[var(--tx)] active:cursor-grabbing"
    >
      <Icon name="grip-vertical" />
    </PlainButton>
  )
}

/** Panel position menu: move the dock to an edge, swap the side panels, reset. */
function DockMenu() {
  const t = useT()
  const host = useRendererHost()
  const position = useShell((s) => s.dockPosition)
  const run = (id: string) => () => void host.commands.execute(id)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon="layout-panel-left" label={t('core:dock.menu')} testId={T.dockMenu} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={position}>
          {DOCK_POSITIONS.map((p) => (
            <DropdownMenuRadioItem
              key={p}
              value={p}
              data-testid={T.dockMoveTo(p)}
              onSelect={run(MOVE_DOCK_COMMANDS[p].id)}
            >
              {t(POSITION_LABEL[p])}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem data-testid={T.dockSwapSides} onSelect={run(CoreCommands.swapSidePanels)}>
          {t('core:dock.swap')}
        </DropdownMenuItem>
        <DropdownMenuItem data-testid={T.dockReset} onSelect={run(CoreCommands.resetLayout)}>
          {t('core:dock.reset')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DockControls() {
  return (
    <>
      <DockDragHandle />
      <DockMenu />
    </>
  )
}
