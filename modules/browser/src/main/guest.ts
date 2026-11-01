import type { Disposable, Rect } from '@pragma/sdk'

/** The subset of `Electron.WebContents` the module uses (tests use a fake). */
export interface GuestLike {
  id: number
  loadURL(url: string): Promise<void>
  getURL(): string
  getTitle(): string
  isLoading(): boolean
  navigationHistory: { canGoBack(): boolean; canGoForward(): boolean; goBack(): void; goForward(): void }
  reload(): void
  stop(): void
  setZoomFactor(f: number): void
  getZoomFactor(): number
  openDevTools(o: { mode: 'detach' }): void
  closeDevTools(): void
  isDevToolsOpened(): boolean
  setWindowOpenHandler(h: (d: { url: string }) => { action: 'deny' }): void
  on(event: string, cb: (...a: unknown[]) => void): void
  off(event: string, cb: (...a: unknown[]) => void): void
  isDestroyed(): boolean
  close(): void
  executeJavaScript(code: string): Promise<unknown>
  executeJavaScriptInIsolatedWorld(worldId: number, scripts: { code: string }[]): Promise<unknown>
  capturePage(rect?: Rect): Promise<ImageLike>
}

/** The subset of `Electron.NativeImage` used for element screenshots. */
export interface ImageLike {
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  crop(rect: Rect): ImageLike
  toPNG(): Buffer
}

export interface ViewLike {
  webContents: GuestLike
}

/** Everything the tab manager needs from Electron and the SDK (a port, so the manager is unit-testable). */
export interface BrowserHost {
  createView(partition: string): ViewLike
  /** → `ctx.nativeViews.attach(viewId, view, { panelTabId, inset: { top: VIEW_INSET_TOP_PX } })`. */
  attach(viewId: string, view: ViewLike): Disposable
  detach(viewId: string): void
  show(viewId: string): void
  hide(viewId: string): void
  freeze(viewId: string): Promise<void>
  unfreeze(viewId: string): Promise<void>
  openExternal(url: string): Promise<void>
  clearPartition(partition: string): Promise<void>
  now(): number
}

/** Electron's navigation events (`will-navigate`, `will-redirect`, `will-frame-navigate`) carry these. */
export interface NavigationEventLike {
  url: string
  isMainFrame: boolean
  preventDefault(): void
}
