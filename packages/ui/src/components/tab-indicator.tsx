import { type ComponentProps, useLayoutEffect, useRef, useState } from 'react'
import { type IndicatorPlacement, samePlacement, watchSelectedTab } from '../lib/tab-indicator'
import { cn } from '../lib/utils'

export const TAB_INDICATOR_EDGES = ['top', 'bottom'] as const
export type TabIndicatorEdge = (typeof TAB_INDICATOR_EDGES)[number]

const EDGE_CLASS: Record<TabIndicatorEdge, string> = { top: 'top-0', bottom: 'bottom-0' }

/**
 * `placement` is the last known one, kept while hidden so the line fades out in place. `snap`: the line just
 * (re)appeared (first paint, a tab selected again, a panel shown); it jumps there instead of sliding in.
 */
interface IndicatorState {
  placement: IndicatorPlacement | null
  visible: boolean
  snap: boolean
}
const INITIAL: IndicatorState = { placement: null, visible: false, snap: true }

function nextState(prev: IndicatorState, placement: IndicatorPlacement | null): IndicatorState {
  if (!placement) return prev.visible ? { ...prev, visible: false } : prev
  if (prev.visible && samePlacement(prev.placement, placement)) return prev
  return { placement, visible: true, snap: !prev.visible }
}

/**
 * The selected-tab line of a tab strip. Render it as the last child of the tab list (which must be `relative`): it
 * finds the selected tab (`aria-selected`) among its siblings and slides (translate + width, motion tokens) from tab
 * to tab, following resizes and tabs added, removed or reordered. Tabs then drop their own selected border.
 */
export function TabIndicator({
  edge = 'bottom',
  className,
  ...props
}: { edge?: TabIndicatorEdge } & Omit<ComponentProps<'span'>, 'children' | 'style'>) {
  const ref = useRef<HTMLSpanElement>(null)
  const [state, setState] = useState(INITIAL)
  useLayoutEffect(() => {
    const list = ref.current?.parentElement
    if (!list) return
    return watchSelectedTab(list, (placement) => setState((prev) => nextState(prev, placement)))
  }, [])
  const { placement, visible, snap } = state
  return (
    <span
      ref={ref}
      aria-hidden
      data-animate={String(!snap)}
      className={cn(
        'pointer-events-none absolute left-0 h-0.5 bg-[var(--ac)]',
        'transition-[transform,width,opacity] duration-[var(--motion-duration-base)] ease-[var(--motion-ease-emphasized)]',
        snap && 'transition-none',
        EDGE_CLASS[edge],
        className,
      )}
      style={{
        width: placement?.width ?? 0,
        transform: `translateX(${placement?.x ?? 0}px)`,
        opacity: visible ? 1 : 0,
      }}
      {...props}
    />
  )
}
