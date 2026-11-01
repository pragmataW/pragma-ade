import { type ComponentType, createElement, Fragment, type ReactNode, useEffect } from 'react'
import { DEFAULT_OVERLAY_GUARD_MODE, type OverlayGuardMode } from '../constants/overlay'

export { OVERLAY_GUARD_MODES, type OverlayGuardMode } from '../constants/overlay'

export type OverlayGuardReporter = (delta: 1 | -1, mode: OverlayGuardMode) => void

let reporter: OverlayGuardReporter | null = null

/** The shell wires this to `core.nativeViews.occlusion`; without a reporter the guard is a no-op. */
export function setOverlayGuardReporter(fn: OverlayGuardReporter | null): void {
  reporter = fn
}

/** Reports +1 while `open` is true and −1 on close/unmount, so native views hide (or freeze) under overlays. */
export function useOverlayGuard(open: boolean, opts: { mode?: OverlayGuardMode } = {}): void {
  const mode = opts.mode ?? DEFAULT_OVERLAY_GUARD_MODE
  useEffect(() => {
    if (!open) return
    reporter?.(1, mode)
    return () => reporter?.(-1, mode)
  }, [open, mode])
}

export type GuardedProps<P> = P & { guardMode?: OverlayGuardMode; children?: ReactNode }

/** Rendered inside the overlay's content, so it mounts and unmounts with it (Radix keeps the wrapper mounted). */
function GuardMarker({ mode }: { mode?: OverlayGuardMode }): null {
  useOverlayGuard(true, { mode })
  return null
}

/** Wraps overlay content with the guard; `defaults` fill props the caller omits. */
export function withOverlayGuard<P extends object>(Content: ComponentType<P>, defaults: Partial<P> = {}) {
  function Guarded({ guardMode, children, ...props }: GuardedProps<P>) {
    const marked = createElement(Fragment, null, createElement(GuardMarker, { mode: guardMode }), children)
    return createElement(Content, { ...defaults, ...(props as P) }, marked)
  }
  Guarded.displayName = `Guarded(${Content.displayName ?? Content.name})`
  return Guarded
}
