/**
 * Overlay guard modes (§10.2). Only native views an open overlay intersects are touched; they are swapped for a page
 * snapshot. 'hide' falls back to just hiding the view when the capture is slow or fails; 'snapshot' waits for it.
 */
export const OVERLAY_GUARD_MODES = ['hide', 'snapshot'] as const
export type OverlayGuardMode = (typeof OVERLAY_GUARD_MODES)[number]
export const DEFAULT_OVERLAY_GUARD_MODE: OverlayGuardMode = 'hide'
/** The mode that always waits for the page capture (and wins when several overlays cover a view). */
export const SNAPSHOT_GUARD_MODE: OverlayGuardMode = 'snapshot'
export const ANCHORED_POPOVER_GUARD_MODE = SNAPSHOT_GUARD_MODE

/** What a guarded overlay covers: the whole window (modal with a backdrop) or just its own content box. */
export const OVERLAY_COVERS = ['window', 'content'] as const
export type OverlayCoverKind = (typeof OVERLAY_COVERS)[number]
export const DEFAULT_OVERLAY_COVER: OverlayCoverKind = 'content'
