import { useDndContext, useDroppable } from '@dnd-kit/core'
import { ShellTestIds as T } from '@pragma/sdk'
import { useT } from '@pragma/sdk/renderer'
import { useOverlayGuard } from '@pragma/ui/lib/overlay-guard'
import { cn } from '@pragma/ui/lib/utils'
import { type CSSProperties, useEffect, useState } from 'react'
import { asDockPosition, DOCK_POSITIONS, type DockPosition } from '../lib/dock-layout'
import { useShell } from '../lib/shell-context'
import { POSITION_LABEL } from './DockControls'

/** Where each drop zone sits over the work area. */
const ZONE: Record<DockPosition, string> = {
  left: 'inset-y-0 left-0 w-1/4',
  right: 'inset-y-0 right-0 w-1/4',
  top: 'inset-x-1/4 top-0 h-1/3',
  bottom: 'inset-x-1/4 bottom-0 h-1/3',
}

const THIRD = 'calc(100% / 3)'
const TWO_THIRDS = 'calc(100% * 2 / 3)'
const FULL = '100%'
const NONE = '0%'
/** The dock's box once dropped on each edge. One preview moves between them, so every edge sets the same properties. */
const PREVIEW: Record<DockPosition, CSSProperties> = {
  left: { left: NONE, top: NONE, width: THIRD, height: FULL },
  right: { left: TWO_THIRDS, top: NONE, width: THIRD, height: FULL },
  top: { left: NONE, top: NONE, width: FULL, height: THIRD },
  bottom: { left: NONE, top: TWO_THIRDS, width: FULL, height: THIRD },
}

function DropZone({ position }: { position: DockPosition }) {
  const t = useT()
  const { setNodeRef } = useDroppable({ id: position })
  return (
    <div
      ref={setNodeRef}
      data-testid={T.dockDropZone(position)}
      title={t(POSITION_LABEL[position])}
      className={cn('absolute', ZONE[position])}
    />
  )
}

/**
 * The dock's drop preview: it fades in over the first zone hovered, then glides and resizes to each zone hovered
 * after (motion tokens); leaving every zone fades it out where it was.
 */
function DropPreview() {
  const t = useT()
  const hovered = asDockPosition(useDndContext().over?.id)
  const [last, setLast] = useState<DockPosition | null>(null)
  useEffect(() => {
    if (hovered) setLast(hovered)
  }, [hovered])
  const shown = hovered ?? last
  if (!shown) return null
  return (
    <div
      data-position={shown}
      style={{ ...PREVIEW[shown], opacity: hovered ? 1 : 0 }}
      className={cn(
        'pointer-events-none absolute flex items-center justify-center rounded-[var(--radius-card)] border-2 border-[var(--ac)] bg-[var(--acs)] text-[var(--act)] text-xs',
        'fade-in-0 animate-in transition-[left,top,width,height,opacity] duration-[var(--motion-duration-slow)] ease-[var(--motion-ease-emphasized)]',
      )}
    >
      {t('core:dock.dropHint')}
    </div>
  )
}

/** Drop zones over the work area while the dock is dragged; native views are frozen into snapshots meanwhile. */
export function DockDropOverlay() {
  const dragging = useShell((s) => s.dockDragging)
  useOverlayGuard(dragging, { mode: 'snapshot' })
  if (!dragging) return null
  return (
    <div data-testid={T.dockDropOverlay} className="absolute inset-0 z-50">
      <DropPreview />
      {DOCK_POSITIONS.map((p) => (
        <DropZone key={p} position={p} />
      ))}
    </div>
  )
}
