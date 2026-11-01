import type { Rect, Viewport } from '../../contract'

/** A page rect (CSS px of the guest viewport) in window coordinates, given the view area's window rect. */
export function pickRectInWindow(rect: Rect, viewport: Viewport, area: Rect): Rect {
  const scale = viewport.width > 0 ? area.width / viewport.width : 1
  return {
    x: area.x + rect.x * scale,
    y: area.y + rect.y * scale,
    width: rect.width * scale,
    height: rect.height * scale,
  }
}
