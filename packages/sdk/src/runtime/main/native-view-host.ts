import type { OverlayGuardMode } from '@pragma/ui/constants/overlay'
import { CoreIpc, type Occlusion, type OverlayCover } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { IpcEventContract } from '../../common/ipc'
import type { Inset, Rect } from '../../common/shell'
import { SNAPSHOT_CLEAR_DELAY_MS, SNAPSHOT_PAINT_DELAY_MS } from '../../constants'
import { captureFor, coverModeFor, sleep } from './occlusion'

export class DuplicateViewError extends Error {}
export class UnknownViewError extends Error {}

/** What the host needs from a `WebContentsView` (the shell adapts the real one). */
export interface NativeViewLike {
  setBounds(r: Rect): void
  setVisible(v: boolean): void
  /** Resolves to a PNG data URL of the current page. */
  capture(): Promise<string>
}

export interface ViewContainer {
  add(view: NativeViewLike): void
  remove(view: NativeViewLike): void
}

export { OVERLAY_GUARD_MODES, type OverlayGuardMode } from '@pragma/ui/constants/overlay'

export type PublishFn = <P>(c: IpcEventContract<P>, payload: P) => void

interface ViewEntry {
  id: string
  view: NativeViewLike
  tabId: string
  inset: Inset
  shown: boolean
  frozen: boolean
  /** Hidden because an overlay intersects it (its snapshot, if captured, is shown instead). */
  covered: boolean
  /** A snapshot image of this view is currently published to the renderer. */
  snapshot: boolean
  capturing: Promise<void> | null
  clearTimer: ReturnType<typeof setTimeout> | null
  bounds: Rect | null
  visible: boolean | undefined
}

const sameRect = (a: Rect | null, b: Rect | null): boolean =>
  a === b || (a !== null && b !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height)

function effectiveBounds(tab: Rect | null | undefined, inset: Inset): Rect | null {
  if (!tab) return null
  const top = inset.top ?? 0
  const left = inset.left ?? 0
  return {
    x: Math.round(tab.x + left),
    y: Math.round(tab.y + top),
    width: Math.round(tab.width - left - (inset.right ?? 0)),
    height: Math.round(tab.height - top - (inset.bottom ?? 0)),
  }
}

/**
 * Keeps WebContentsViews glued to their right-panel tab: one visible view per tab, insets, and overlay protection
 * (only views an open `@pragma/ui` overlay intersects are swapped for a page snapshot; explicit freeze/unfreeze)
 * (§7, §10.2).
 */
export class NativeViewHost {
  readonly #views = new Map<string, ViewEntry>()
  readonly #tabBounds = new Map<string, Rect | null>()
  readonly #container: ViewContainer
  readonly #publish: PublishFn
  #covers: OverlayCover[] = []

  constructor(container: ViewContainer, publish: PublishFn) {
    this.#container = container
    this.#publish = publish
  }

  attach(viewId: string, view: NativeViewLike, opts: { panelTabId: string; inset?: Inset }): Disposable {
    if (this.#views.has(viewId)) throw new DuplicateViewError(`native view ${viewId} is already attached`)
    const entry: ViewEntry = {
      id: viewId,
      view,
      tabId: opts.panelTabId,
      inset: opts.inset ?? {},
      shown: true,
      frozen: false,
      covered: false,
      snapshot: false,
      capturing: null,
      clearTimer: null,
      bounds: null,
      visible: undefined,
    }
    this.#views.set(viewId, entry)
    this.#container.add(view)
    this.#showOnly(entry)
    return toDisposable(() => this.detach(viewId))
  }

  detach(viewId: string): void {
    const entry = this.#views.get(viewId)
    if (!entry) return
    this.#views.delete(viewId)
    this.#container.remove(entry.view)
    this.#cancelClear(entry)
    if (entry.frozen || entry.snapshot) this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId })
  }

  show(viewId: string): void {
    this.#showOnly(this.#entry(viewId))
  }

  hide(viewId: string): void {
    const entry = this.#entry(viewId)
    entry.shown = false
    this.#apply(entry)
  }

  setTabBounds(panelTabId: string, bounds: Rect | null): void {
    this.#tabBounds.set(panelTabId, bounds)
    for (const entry of this.#views.values()) if (entry.tabId === panelTabId) this.#apply(entry)
  }

  async freeze(viewId: string): Promise<void> {
    const entry = this.#entry(viewId)
    if (entry.frozen) return
    this.#cancelClear(entry)
    if (entry.visible && entry.bounds && !entry.snapshot) await this.#snapshot(entry, entry.bounds)
    entry.frozen = true
    entry.covered = false
    this.#apply(entry)
  }

  async unfreeze(viewId: string): Promise<void> {
    const entry = this.#entry(viewId)
    if (!entry.frozen) return
    entry.frozen = false
    entry.snapshot = false
    this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId })
    this.#apply(entry)
  }

  /** Swaps the views the open overlays intersect for snapshots; resolves once those are hidden. */
  async setOcclusion(o: Occlusion): Promise<void> {
    this.#covers = o.covers
    const entries = [...this.#views.values()]
    for (const entry of entries) this.#apply(entry)
    await Promise.all(entries.filter((e) => this.#coverMode(e) !== null).map((e) => e.capturing))
  }

  state(viewId: string): { bounds: Rect | null; visible: boolean } | undefined {
    const entry = this.#views.get(viewId)
    return entry ? { bounds: entry.bounds, visible: entry.visible ?? false } : undefined
  }

  /** Re-adds every view to a recreated window (macOS Dock reopen). */
  reattachAll(): void {
    for (const entry of this.#views.values()) {
      this.#container.add(entry.view)
      entry.bounds = null
      entry.visible = undefined
      this.#apply(entry)
    }
  }

  viewIds(): string[] {
    return [...this.#views.keys()]
  }

  #entry(viewId: string): ViewEntry {
    const entry = this.#views.get(viewId)
    if (!entry) throw new UnknownViewError(`unknown native view ${viewId}`)
    return entry
  }

  #showOnly(target: ViewEntry): void {
    for (const entry of this.#views.values()) {
      if (entry.tabId !== target.tabId) continue
      entry.shown = entry === target
      this.#apply(entry)
    }
  }

  async #snapshot(entry: ViewEntry, bounds: Rect): Promise<void> {
    this.#showSnapshot(entry, bounds, await entry.view.capture())
  }

  #showSnapshot(entry: ViewEntry, bounds: Rect, dataUrl: string): void {
    entry.snapshot = true
    this.#publish(CoreIpc.nativeViewsSnapshot, { viewId: entry.id, bounds, dataUrl })
  }

  /** Which overlay mode covers the view right now, or null when it is not on screen or nothing intersects it. */
  #coverMode(entry: ViewEntry): OverlayGuardMode | null {
    if (!entry.shown || entry.frozen || !entry.bounds) return null
    return coverModeFor(this.#covers, entry.bounds)
  }

  /**
   * Captures once, publishes the snapshot, gives the renderer a frame or two to paint it, then hides the view. Bails
   * out (and lets any snapshot go) when the overlay has moved off or closed by then.
   */
  #cover(entry: ViewEntry, mode: OverlayGuardMode): void {
    if (entry.capturing) return
    this.#cancelClear(entry)
    const captured = captureFor(mode, entry.view.capture())
    const stillCovered = () => this.#views.get(entry.id) === entry && this.#coverMode(entry) !== null
    entry.capturing = (async () => {
      const dataUrl = await captured
      if (dataUrl && stillCovered() && entry.bounds) {
        this.#showSnapshot(entry, entry.bounds, dataUrl)
        await sleep(SNAPSHOT_PAINT_DELAY_MS)
      }
      entry.capturing = null
      if (stillCovered()) {
        entry.covered = true
        this.#apply(entry)
      } else this.#scheduleClear(entry)
    })()
  }

  /** Drops the snapshot once the re-shown view has had time to paint over it. */
  #scheduleClear(entry: ViewEntry): void {
    this.#cancelClear(entry)
    if (!entry.snapshot || entry.frozen || this.#views.get(entry.id) !== entry) return
    entry.clearTimer = setTimeout(() => {
      entry.clearTimer = null
      entry.snapshot = false
      this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId: entry.id })
    }, SNAPSHOT_CLEAR_DELAY_MS)
  }

  #cancelClear(entry: ViewEntry): void {
    if (entry.clearTimer) clearTimeout(entry.clearTimer)
    entry.clearTimer = null
  }

  #apply(entry: ViewEntry): void {
    const bounds = effectiveBounds(this.#tabBounds.get(entry.tabId), entry.inset)
    if (bounds && !sameRect(bounds, entry.bounds)) entry.view.setBounds(bounds)
    entry.bounds = bounds
    const mode = this.#coverMode(entry)
    const uncovering = mode === null && entry.covered
    if (uncovering) entry.covered = false
    const visible = entry.shown && bounds !== null && !entry.frozen && !entry.covered
    if (visible !== entry.visible) entry.view.setVisible(visible)
    entry.visible = visible
    if (uncovering) this.#scheduleClear(entry)
    else if (mode !== null && !entry.covered) this.#cover(entry, mode)
  }
}
