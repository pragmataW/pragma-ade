import { CoreIpc, type Occlusion } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { IpcEventContract } from '../../common/ipc'
import type { Inset, Rect } from '../../common/shell'

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

export const OVERLAY_GUARD_MODES = ['hide', 'snapshot'] as const
export type OverlayGuardMode = (typeof OVERLAY_GUARD_MODES)[number]

export type PublishFn = <P>(c: IpcEventContract<P>, payload: P) => void

interface ViewEntry {
  id: string
  view: NativeViewLike
  tabId: string
  inset: Inset
  shown: boolean
  frozen: boolean
  occlusionSnapshot: boolean
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
 * (hide or snapshot while a `@pragma/ui` overlay is open; explicit freeze/unfreeze) (§7, §10.2).
 */
export class NativeViewHost {
  readonly #views = new Map<string, ViewEntry>()
  readonly #tabBounds = new Map<string, Rect | null>()
  readonly #container: ViewContainer
  readonly #publish: PublishFn
  #occlusion: Occlusion = { hide: false, snapshot: false }

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
      occlusionSnapshot: false,
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
    if (entry.frozen || entry.occlusionSnapshot) this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId })
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
    if (entry.visible && entry.bounds && !entry.occlusionSnapshot) await this.#snapshot(entry, entry.bounds)
    entry.frozen = true
    entry.occlusionSnapshot = false
    this.#apply(entry)
  }

  async unfreeze(viewId: string): Promise<void> {
    const entry = this.#entry(viewId)
    if (!entry.frozen) return
    entry.frozen = false
    this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId })
    this.#apply(entry)
  }

  async setOcclusion(o: Occlusion): Promise<void> {
    if (o.snapshot) {
      const targets = [...this.#views.values()].filter((e) => e.visible && e.bounds && !e.frozen)
      for (const entry of targets) {
        await this.#snapshot(entry, entry.bounds as Rect)
        entry.occlusionSnapshot = true
      }
    } else this.#clearOcclusionSnapshots()
    this.#occlusion = { ...o }
    for (const entry of this.#views.values()) this.#apply(entry)
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
    const dataUrl = await entry.view.capture()
    this.#publish(CoreIpc.nativeViewsSnapshot, { viewId: entry.id, bounds, dataUrl })
  }

  #clearOcclusionSnapshots(): void {
    for (const entry of this.#views.values()) {
      if (!entry.occlusionSnapshot) continue
      entry.occlusionSnapshot = false
      this.#publish(CoreIpc.nativeViewsSnapshotCleared, { viewId: entry.id })
    }
  }

  #apply(entry: ViewEntry): void {
    const bounds = effectiveBounds(this.#tabBounds.get(entry.tabId), entry.inset)
    if (bounds && !sameRect(bounds, entry.bounds)) entry.view.setBounds(bounds)
    entry.bounds = bounds
    const occluded = this.#occlusion.hide || this.#occlusion.snapshot
    const visible = entry.shown && bounds !== null && !entry.frozen && !occluded
    if (visible !== entry.visible) entry.view.setVisible(visible)
    entry.visible = visible
  }
}
