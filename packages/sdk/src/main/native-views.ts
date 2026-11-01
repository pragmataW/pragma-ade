import type { WebContentsView } from 'electron'
import type { Disposable } from '../common/disposable'
import type { Inset } from '../common/shell'

export { OVERLAY_GUARD_MODES, type OverlayGuardMode } from '../runtime/main/native-view-host'

/** `ctx.nativeViews` (§7, §10.2): WebContentsViews that follow a right-panel tab. */
export interface NativeViewsApi {
  /** Shows the view in its tab (hiding the tab's other views) and keeps it at the tab rect minus `inset`. */
  attach(viewId: string, view: WebContentsView, opts: { panelTabId: string; inset?: Inset }): Disposable
  detach(viewId: string): void
  show(viewId: string): void
  hide(viewId: string): void
  /** Captures the page, shows the image in place and hides the view until `unfreeze`. */
  freeze(viewId: string): Promise<void>
  unfreeze(viewId: string): Promise<void>
}
