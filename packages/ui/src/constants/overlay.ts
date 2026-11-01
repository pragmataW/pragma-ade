/** Overlay guard modes (§10.2): hide native views, or replace them with a page snapshot. */
export const OVERLAY_GUARD_MODES = ['hide', 'snapshot'] as const
export type OverlayGuardMode = (typeof OVERLAY_GUARD_MODES)[number]
export const DEFAULT_OVERLAY_GUARD_MODE: OverlayGuardMode = 'hide'
export const ANCHORED_POPOVER_GUARD_MODE: OverlayGuardMode = 'snapshot'
