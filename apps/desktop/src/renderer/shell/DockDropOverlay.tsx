import { useDroppable } from '@dnd-kit/core'
import { ShellTestIds as T } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { useOverlayGuard } from '@pragma/ui/lib/overlay-guard'
import { cn } from '@pragma/ui/lib/utils'
import { DOCK_POSITIONS, type DockPosition } from '../lib/dock-layout'
import { useShell } from '../lib/shell-context'
import { POSITION_LABEL } from './DockControls'

/** Where each drop zone sits over the work area, and the preview of the dock once dropped there. */
const ZONE: Record<DockPosition, { zone: string; preview: string }> = {
  left: { zone: 'inset-y-0 left-0 w-1/4', preview: 'inset-y-0 left-0 w-1/3' },
  right: { zone: 'inset-y-0 right-0 w-1/4', preview: 'inset-y-0 right-0 w-1/3' },
  top: { zone: 'inset-x-1/4 top-0 h-1/3', preview: 'inset-x-0 top-0 h-1/3' },
  bottom: { zone: 'inset-x-1/4 bottom-0 h-1/3', preview: 'inset-x-0 bottom-0 h-1/3' },
}

function DropZone({ position }: { position: DockPosition }) {
  const t = useT()
  const { setNodeRef, isOver } = useDroppable({ id: position })
  return (
    <>
      {isOver && (
        <div
          className={cn(
            'pointer-events-none absolute flex items-center justify-center rounded-[var(--radius-card)] border-2 border-[var(--ac)] bg-[var(--acs)] text-[var(--act)] text-xs',
            ZONE[position].preview,
          )}
        >
          {t('core:dock.dropHint')}
        </div>
      )}
      <div
        ref={setNodeRef}
        data-testid={T.dockDropZone(position)}
        title={t(POSITION_LABEL[position])}
        className={cn('absolute', ZONE[position].zone)}
      />
    </>
  )
}

/** Drop zones over the work area while the dock is dragged; native views are frozen into snapshots meanwhile. */
export function DockDropOverlay() {
  const dragging = useShell((s) => s.dockDragging)
  useOverlayGuard(dragging, { mode: 'snapshot' })
  if (!dragging) return null
  return (
    <div data-testid={T.dockDropOverlay} className="absolute inset-0 z-50">
      {DOCK_POSITIONS.map((p) => (
        <DropZone key={p} position={p} />
      ))}
    </div>
  )
}
