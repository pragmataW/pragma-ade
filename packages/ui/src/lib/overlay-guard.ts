import {
  type ComponentType,
  createElement,
  Fragment,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react'
import {
  DEFAULT_OVERLAY_COVER,
  DEFAULT_OVERLAY_GUARD_MODE,
  type OverlayCoverKind,
  type OverlayGuardMode,
} from '../constants/overlay'

export {
  OVERLAY_COVERS,
  OVERLAY_GUARD_MODES,
  type OverlayCoverKind,
  type OverlayGuardMode,
} from '../constants/overlay'

export interface OverlayRect {
  x: number
  y: number
  width: number
  height: number
}
/** One open overlay: its window rect, or `null` when it covers the whole window (modal backdrop). */
export interface OverlayCover {
  mode: OverlayGuardMode
  rect: OverlayRect | null
}
/** Receives every open overlay's cover whenever the set (or a rect) changes. */
export type OverlayGuardReporter = (covers: OverlayCover[]) => void

const covers = new Map<number, OverlayCover>()
let nextId = 0
let reporter: OverlayGuardReporter | null = null
let reported: string | null = null

function report(): void {
  const list = [...covers.values()]
  const key = JSON.stringify(list)
  if (key === reported) return
  reported = key
  reporter?.(list)
}

/** The shell wires this to `core.nativeViews.occlusion`; without a reporter the guard is a no-op. */
export function setOverlayGuardReporter(fn: OverlayGuardReporter | null): void {
  reporter = fn
  reported = null
  if (fn) report()
}

/** Whole pixels, rounded outwards so the cover never falls short of the painted box. */
function outerRect(el: Element): OverlayRect {
  const r = el.getBoundingClientRect()
  const x = Math.floor(r.left)
  const y = Math.floor(r.top)
  return { x, y, width: Math.ceil(r.right) - x, height: Math.ceil(r.bottom) - y }
}

/**
 * While `open`, reports a cover so the native views under it are swapped for snapshots (§10.2). With `target`, the
 * cover is that element's box, re-measured every frame (menus position and animate after mounting); without it, the
 * whole window.
 */
export function useOverlayGuard(
  open: boolean,
  opts: { mode?: OverlayGuardMode; target?: RefObject<Element | null> } = {},
): void {
  const mode = opts.mode ?? DEFAULT_OVERLAY_GUARD_MODE
  const target = opts.target
  useEffect(() => {
    if (!open) return
    const id = nextId++
    let frame = 0
    const measure = () => {
      const el = target?.current
      if (target && !el) covers.delete(id)
      else covers.set(id, { mode, rect: el ? outerRect(el) : null })
      report()
    }
    const loop = () => {
      measure()
      frame = requestAnimationFrame(loop)
    }
    if (target) loop()
    else measure()
    return () => {
      cancelAnimationFrame(frame)
      covers.delete(id)
      report()
    }
  }, [open, mode, target])
}

export type GuardedProps<P> = P & { guardMode?: OverlayGuardMode; children?: ReactNode }

/**
 * Rendered inside the overlay's content, so it mounts and unmounts with it (Radix keeps the wrapper mounted). For a
 * 'content' cover it leaves a hidden marker whose parent (the content element) is measured.
 */
function GuardMarker({ mode, cover }: { mode?: OverlayGuardMode; cover: OverlayCoverKind }) {
  const content = useRef<Element | null>(null)
  const mark = useCallback((el: HTMLElement | null) => {
    content.current = el?.parentElement ?? null
  }, [])
  const measured = cover === DEFAULT_OVERLAY_COVER
  useOverlayGuard(true, { mode, target: measured ? content : undefined })
  return measured ? createElement('span', { ref: mark, hidden: true }) : null
}

/** `withOverlayGuard` option for modals with a backdrop: every native view is covered. */
export const MODAL_COVER: { cover: OverlayCoverKind } = { cover: 'window' }

/** Wraps overlay content with the guard; `defaults` fill props the caller omits. */
export function withOverlayGuard<P extends object>(
  Content: ComponentType<P>,
  defaults: Partial<P> = {},
  { cover = DEFAULT_OVERLAY_COVER }: { cover?: OverlayCoverKind } = {},
) {
  function Guarded({ guardMode, children, ...props }: GuardedProps<P>) {
    const marked = createElement(Fragment, null, createElement(GuardMarker, { mode: guardMode, cover }), children)
    return createElement(Content, { ...defaults, ...(props as P) }, marked)
  }
  Guarded.displayName = `Guarded(${Content.displayName ?? Content.name})`
  return Guarded
}
