import { computePosition, flip, offset, type Placement, shift } from '@floating-ui/dom'
import { POPOVER_OFFSET_PX, VIEWPORT_PADDING_PX } from '../constants/ui'

export type { Placement }

export interface AnchorRect {
  x: number
  y: number
  width: number
  height: number
}

const DEFAULT_PLACEMENT: Placement = 'bottom-start'

/** Positions `floating` next to an arbitrary rect (e.g. an element inside a frozen page snapshot). */
export async function placePopover(
  anchor: AnchorRect,
  floating: HTMLElement,
  opts: { placement?: Placement; offsetPx?: number } = {},
): Promise<{ x: number; y: number; placement: Placement }> {
  const virtual = {
    getBoundingClientRect: () => ({
      ...anchor,
      top: anchor.y,
      left: anchor.x,
      right: anchor.x + anchor.width,
      bottom: anchor.y + anchor.height,
    }),
  }
  const result = await computePosition(virtual, floating, {
    placement: opts.placement ?? DEFAULT_PLACEMENT,
    strategy: 'fixed',
    middleware: [offset(opts.offsetPx ?? POPOVER_OFFSET_PX), flip(), shift({ padding: VIEWPORT_PADDING_PX })],
  })
  return { x: result.x, y: result.y, placement: result.placement }
}
