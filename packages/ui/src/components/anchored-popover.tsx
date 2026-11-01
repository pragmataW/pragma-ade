import { type ReactNode, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ANCHORED_POPOVER_GUARD_MODE, type OverlayGuardMode } from '../constants/overlay'
import { useOverlayGuard } from '../lib/overlay-guard'
import { type AnchorRect, type Placement, placePopover } from '../lib/place-popover'

const RESIZE_EVENT = 'resize'
const ESCAPE = 'Escape'
const KEYDOWN = 'keydown'

/** A popover positioned at an arbitrary rect (e.g. a picked element in a frozen page); overlay-guarded (snapshot). */
export function AnchoredPopover({
  rect,
  open,
  onOpenChange,
  placement,
  guardMode = ANCHORED_POPOVER_GUARD_MODE,
  children,
}: {
  rect: AnchorRect
  open: boolean
  onOpenChange(open: boolean): void
  placement?: Placement
  guardMode?: OverlayGuardMode
  children: ReactNode
}) {
  useOverlayGuard(open, { mode: guardMode })
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const update = () => void placePopover(rect, el, { placement }).then(setPosition)
    const onKey = (e: KeyboardEvent) => e.key === ESCAPE && onOpenChange(false)
    update()
    window.addEventListener(RESIZE_EVENT, update)
    window.addEventListener(KEYDOWN, onKey)
    return () => {
      window.removeEventListener(RESIZE_EVENT, update)
      window.removeEventListener(KEYDOWN, onKey)
    }
  }, [open, rect, placement, onOpenChange])
  if (!open) return null
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      className="fixed z-50 rounded-[var(--radius-popover)] border border-[var(--bd)] bg-[var(--el)] p-3 text-[var(--tx)] shadow-lg"
      style={{ left: position?.x ?? rect.x, top: position?.y ?? rect.y + rect.height }}
    >
      {children}
    </div>,
    document.body,
  )
}
