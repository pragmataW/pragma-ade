import { useT } from '@pragma/sdk/renderer'
import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'
import { TREE_MAX_WIDTH_PX, TREE_MIN_WIDTH_PX, TREE_RESIZE_STEP_PX, TREE_WIDTH_PX } from '../constants'

const clamp = (px: number): number => Math.min(TREE_MAX_WIDTH_PX, Math.max(TREE_MIN_WIDTH_PX, px))
const STEP_BY_KEY = new Map([
  ['ArrowLeft', -TREE_RESIZE_STEP_PX],
  ['ArrowRight', TREE_RESIZE_STEP_PX],
])

/** Left pane (the tree, 232px by default) and right pane, with a draggable / arrow-key separator. */
export function SplitPane({ left, right }: { left: ReactNode; right: ReactNode }) {
  const t = useT()
  const [width, setWidth] = useState(TREE_WIDTH_PX)
  const drag = useRef<{ x: number; width: number } | null>(null)
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(clamp(drag.current.width + e.clientX - drag.current.x))
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = STEP_BY_KEY.get(e.key)
    if (step === undefined) return
    e.preventDefault()
    e.stopPropagation()
    setWidth((w) => clamp(w + step))
  }
  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-h-0 shrink-0 border-[var(--bd)] border-r py-1" style={{ width }}>
        {left}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: a focusable splitter, <hr> cannot be dragged */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={width}
        aria-valuemin={TREE_MIN_WIDTH_PX}
        aria-valuemax={TREE_MAX_WIDTH_PX}
        aria-label={t('git-changes:tree.resize')}
        tabIndex={0}
        className="-ml-0.5 w-1 shrink-0 cursor-col-resize hover:bg-[var(--ac)] focus-visible:bg-[var(--ac)] focus-visible:outline-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => {
          drag.current = null
        }}
        onKeyDown={onKeyDown}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{right}</div>
    </div>
  )
}
