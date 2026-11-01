import { randomUUID } from 'node:crypto'
import type { Disposable, RingBuffer } from '@pragma/sdk'
import { DEFAULT_ZOOM, ERR_ABORTED, EXTERNAL_OPEN_MIN_INTERVAL_MS, VIEW_ID_PREFIX, ZOOM_STEPS } from '../constants'
import {
  BROWSER_ERROR_CODE,
  BrowserError,
  type BrowserSettings,
  type BrowserSnapshot,
  type BrowserTabState,
  HISTORY_ACTION,
  type HistoryAction,
  normalizeAddressInput,
  ZOOM_ACTION,
  type ZoomAction,
} from '../contract'
import {
  type ConsoleEntry,
  createConsoleBuffer,
  ERROR_LEVEL,
  normalizeConsoleEvent,
  resizeConsoleBuffer,
} from './console-buffer'
import type { BrowserHost, GuestLike, NavigationEventLike, ViewLike } from './guest'
import { classifyNavigation, NAVIGATION_CLASS } from './navigation-policy'
import { partitionForWorktree } from './partition'

export type { BrowserHost, GuestLike } from './guest'

interface Tab {
  state: BrowserTabState
  view: ViewLike | null
  attachment: Disposable | null
  console: RingBuffer<ConsoleEntry>
  lastExternal: { url: string; at: number } | null
  shownSeq: number
}

const NAV_EVENTS = ['will-navigate', 'will-redirect', 'will-frame-navigate'] as const
const EVENT = {
  title: 'page-title-updated',
  startLoading: 'did-start-loading',
  stopLoading: 'did-stop-loading',
  navigate: 'did-navigate',
  navigateInPage: 'did-navigate-in-page',
  favicon: 'page-favicon-updated',
  failLoad: 'did-fail-load',
  console: 'console-message',
  devtoolsOpened: 'devtools-opened',
  devtoolsClosed: 'devtools-closed',
} as const
const DENY = { action: 'deny' } as const

export const viewIdOf = (tabId: string): string => VIEW_ID_PREFIX + tabId

const nextZoom = (current: number, action: ZoomAction): number => {
  switch (action) {
    case ZOOM_ACTION.in:
      return ZOOM_STEPS.find((z) => z > current + Number.EPSILON) ?? current
    case ZOOM_ACTION.out:
      return [...ZOOM_STEPS].reverse().find((z) => z < current - Number.EPSILON) ?? current
    case ZOOM_ACTION.reset:
      return DEFAULT_ZOOM
    default: {
      const never: never = action
      throw new BrowserError(BROWSER_ERROR_CODE.invalidInput, String(never))
    }
  }
}

/**
 * Owns the browser tabs: one WebContentsView per tab in the worktree's partition, at most one visible (the active
 * worktree's active tab), navigation/permission policy, console buffers, LRU discarding, and one coalesced snapshot.
 */
export class BrowserTabManager {
  readonly #host: BrowserHost
  readonly #settings: () => BrowserSettings
  readonly #onChange: (s: BrowserSnapshot) => void
  readonly #tabs = new Map<string, Tab>()
  readonly #worktrees = new Map<string, { tabIds: string[]; activeTabId: string | null }>()
  readonly #closedListeners = new Set<(tabId: string) => void>()
  #activeWorktreeId: string | null = null
  #pickerArmedTabId: string | null = null
  #shownViewId: string | null = null
  #seq = 0
  #emitQueued = false
  #disposed = false

  constructor(host: BrowserHost, settings: () => BrowserSettings, onChange: (s: BrowserSnapshot) => void) {
    this.#host = host
    this.#settings = settings
    this.#onChange = onChange
  }

  setActiveWorktree(id: string | null): void {
    this.#activeWorktreeId = id
    this.#sync()
  }

  get activeWorktreeId(): string | null {
    return this.#activeWorktreeId
  }

  /** The active tab of the active worktree. */
  activeTabId(): string | null {
    return this.#activeWorktreeId ? (this.#worktrees.get(this.#activeWorktreeId)?.activeTabId ?? null) : null
  }

  openTab(worktreeId: string, url?: string): string {
    if (url !== undefined && classifyNavigation(url) !== NAVIGATION_CLASS.internal)
      throw new BrowserError(BROWSER_ERROR_CODE.invalidInput, `cannot open "${url}"`)
    const id = randomUUID()
    const tab: Tab = {
      state: {
        id,
        worktreeId,
        url: url ?? '',
        title: '',
        faviconUrl: null,
        isLoading: false,
        canGoBack: false,
        canGoForward: false,
        zoomFactor: DEFAULT_ZOOM,
        devToolsOpen: false,
        discarded: false,
        loadError: null,
      },
      view: null,
      attachment: null,
      console: createConsoleBuffer(this.#settings().consoleBufferSize),
      lastExternal: null,
      shownSeq: 0,
    }
    this.#tabs.set(id, tab)
    const wt = this.#worktree(worktreeId)
    wt.tabIds.push(id)
    wt.activeTabId = id
    this.#createView(tab)
    if (url) this.#load(tab, url)
    this.#sync()
    return id
  }

  closeTab(tabId: string): void {
    const tab = this.#tab(tabId)
    const wt = this.#worktree(tab.state.worktreeId)
    const index = wt.tabIds.indexOf(tabId)
    wt.tabIds.splice(index, 1)
    if (wt.activeTabId === tabId) wt.activeTabId = wt.tabIds[Math.min(index, wt.tabIds.length - 1)] ?? null
    this.#releaseView(tab)
    this.#tabs.delete(tabId)
    if (this.#pickerArmedTabId === tabId) this.#pickerArmedTabId = null
    for (const cb of [...this.#closedListeners]) cb(tabId)
    this.#sync()
  }

  activateTab(tabId: string): void {
    const tab = this.#tab(tabId)
    this.#worktree(tab.state.worktreeId).activeTabId = tabId
    this.#sync()
  }

  navigate(tabId: string, input: string): string {
    const tab = this.#tab(tabId)
    const target = normalizeAddressInput(input, this.#settings().searchUrl)
    if (!target || classifyNavigation(target.url) !== NAVIGATION_CLASS.internal)
      throw new BrowserError(BROWSER_ERROR_CODE.invalidInput, `cannot load "${input}"`)
    if (tab.state.discarded) this.#revive(tab, false)
    this.#load(tab, target.url)
    this.#sync()
    return target.url
  }

  history(tabId: string, action: HistoryAction): void {
    const guest = this.#liveGuest(tabId)
    switch (action) {
      case HISTORY_ACTION.back:
        if (guest.navigationHistory.canGoBack()) guest.navigationHistory.goBack()
        return
      case HISTORY_ACTION.forward:
        if (guest.navigationHistory.canGoForward()) guest.navigationHistory.goForward()
        return
      case HISTORY_ACTION.reload:
        guest.reload()
        return
      case HISTORY_ACTION.stop:
        guest.stop()
        return
      default: {
        const never: never = action
        throw new BrowserError(BROWSER_ERROR_CODE.invalidInput, String(never))
      }
    }
  }

  toggleDevTools(tabId: string): boolean {
    const guest = this.#liveGuest(tabId)
    const open = !guest.isDevToolsOpened()
    if (open) guest.openDevTools({ mode: 'detach' })
    else guest.closeDevTools()
    return open
  }

  zoom(tabId: string, action: ZoomAction): number {
    const tab = this.#tab(tabId)
    const factor = nextZoom(tab.state.zoomFactor, action)
    this.#liveGuest(tabId).setZoomFactor(factor)
    this.#patch(tab, { zoomFactor: factor })
    return factor
  }

  async removeWorktree(worktreeId: string): Promise<void> {
    for (const tabId of [...(this.#worktrees.get(worktreeId)?.tabIds ?? [])]) this.closeTab(tabId)
    this.#worktrees.delete(worktreeId)
    this.#changed()
    await this.#host.clearPartition(partitionForWorktree(worktreeId))
  }

  getGuest(tabId: string): GuestLike | null {
    const guest = this.#tabs.get(tabId)?.view?.webContents
    return guest && !guest.isDestroyed() ? guest : null
  }

  /** The live view of a tab (null when discarded). */
  getView(tabId: string): ViewLike | null {
    return this.#tabs.get(tabId)?.view ?? null
  }

  /** The tab whose live view hosts `guest` (shortcut dispatch). */
  tabIdOfGuest(guest: GuestLike): string | null {
    for (const [id, tab] of this.#tabs) if (tab.view?.webContents === guest) return id
    return null
  }

  worktreeOf(tabId: string): string {
    return this.#tab(tabId).state.worktreeId
  }

  consoleErrors(tabId: string, n: number): ConsoleEntry[] {
    if (n <= 0) return []
    const errors = this.#tab(tabId)
      .console.toArray()
      .filter((e) => e.level === ERROR_LEVEL)
    return errors.slice(-n)
  }

  onTabClosed(cb: (tabId: string) => void): () => void {
    this.#closedListeners.add(cb)
    return () => this.#closedListeners.delete(cb)
  }

  setPickerArmed(tabId: string | null): void {
    this.#pickerArmedTabId = tabId
    this.#changed()
  }

  /** Re-reads the settings: console buffer sizes and the live-view limit. */
  applySettings(): void {
    const capacity = this.#settings().consoleBufferSize
    for (const tab of this.#tabs.values())
      if (tab.console.capacity !== capacity) tab.console = resizeConsoleBuffer(tab.console, capacity)
    this.#enforceLiveLimit()
    this.#changed()
  }

  snapshot(): BrowserSnapshot {
    return {
      activeWorktreeId: this.#activeWorktreeId,
      worktrees: Object.fromEntries([...this.#worktrees].map(([id, w]) => [id, { ...w, tabIds: [...w.tabIds] }])),
      tabs: Object.fromEntries([...this.#tabs].map(([id, t]) => [id, { ...t.state }])),
      pickerArmedTabId: this.#pickerArmedTabId,
    }
  }

  dispose(): void {
    this.#disposed = true
    for (const tab of this.#tabs.values()) this.#releaseView(tab)
    this.#tabs.clear()
    this.#worktrees.clear()
    this.#closedListeners.clear()
  }

  // ── internals ───────────────────────────────────────────────────────────────────────────────────────────────

  #tab(tabId: string): Tab {
    const tab = this.#tabs.get(tabId)
    if (!tab) throw new BrowserError(BROWSER_ERROR_CODE.tabNotFound, tabId)
    return tab
  }

  #liveGuest(tabId: string): GuestLike {
    const tab = this.#tab(tabId)
    if (tab.state.discarded) this.#revive(tab, true)
    return (tab.view as ViewLike).webContents
  }

  #worktree(id: string) {
    let wt = this.#worktrees.get(id)
    if (!wt) {
      wt = { tabIds: [], activeTabId: null }
      this.#worktrees.set(id, wt)
    }
    return wt
  }

  #createView(tab: Tab): void {
    const view = this.#host.createView(partitionForWorktree(tab.state.worktreeId))
    tab.view = view
    this.#wire(tab, view.webContents)
    tab.attachment = this.#host.attach(viewIdOf(tab.state.id), view)
    this.#shownViewId = viewIdOf(tab.state.id)
  }

  #releaseView(tab: Tab): void {
    const viewId = viewIdOf(tab.state.id)
    tab.attachment?.dispose()
    tab.attachment = null
    if (this.#shownViewId === viewId) this.#shownViewId = null
    const guest = tab.view?.webContents
    tab.view = null
    if (guest && !guest.isDestroyed()) guest.close()
  }

  #revive(tab: Tab, reload: boolean): void {
    this.#createView(tab)
    this.#patch(tab, { discarded: false })
    if (reload && tab.state.url) this.#load(tab, tab.state.url)
  }

  #load(tab: Tab, url: string): void {
    this.#patch(tab, { url, loadError: null })
    const guest = tab.view?.webContents
    // Failures surface through did-fail-load; the rejection itself carries nothing new.
    guest?.loadURL(url).catch(() => undefined)
  }

  #patch(tab: Tab, patch: Partial<BrowserTabState>): void {
    Object.assign(tab.state, patch)
    this.#changed()
  }

  /** The view that should be visible: the active worktree's active tab, unless discarded or showing a load error. */
  #wantedViewId(): string | null {
    const tabId = this.activeTabId()
    const tab = tabId ? this.#tabs.get(tabId) : undefined
    if (!tab || tab.state.loadError) return null
    if (tab.state.discarded) this.#revive(tab, true)
    return viewIdOf(tab.state.id)
  }

  #sync(): void {
    if (this.#disposed) return
    const want = this.#wantedViewId()
    if (want) {
      this.#host.show(want)
      this.#shownViewId = want
      const tab = this.#tabs.get(want.slice(VIEW_ID_PREFIX.length))
      if (tab) tab.shownSeq = ++this.#seq
    } else if (this.#shownViewId) {
      this.#host.hide(this.#shownViewId)
      this.#shownViewId = null
    }
    this.#enforceLiveLimit()
    this.#changed()
  }

  #enforceLiveLimit(): void {
    const live = [...this.#tabs.values()].filter((t) => t.view)
    const excess = live.length - this.#settings().maxLiveViews
    if (excess <= 0) return
    const visible = this.#shownViewId
    const victims = live
      .filter((t) => viewIdOf(t.state.id) !== visible && t.state.id !== this.#pickerArmedTabId)
      .sort((a, b) => a.shownSeq - b.shownSeq)
      .slice(0, excess)
    for (const tab of victims) {
      this.#releaseView(tab)
      tab.state.discarded = true
    }
  }

  #changed(): void {
    if (this.#emitQueued || this.#disposed) return
    this.#emitQueued = true
    queueMicrotask(() => {
      this.#emitQueued = false
      if (!this.#disposed) this.#onChange(this.snapshot())
    })
  }

  #historyFlags(guest: GuestLike): Partial<BrowserTabState> {
    return {
      url: guest.getURL(),
      canGoBack: guest.navigationHistory.canGoBack(),
      canGoForward: guest.navigationHistory.canGoForward(),
    }
  }

  #wire(tab: Tab, guest: GuestLike): void {
    const on = (event: string, cb: (...a: unknown[]) => void) =>
      guest.on(event, (...a) => {
        if (this.#tabs.get(tab.state.id) === tab && tab.view?.webContents === guest) cb(...a)
      })
    on(EVENT.title, (_e, title) => this.#patch(tab, { title: String(title) }))
    on(EVENT.startLoading, () => this.#onStartLoading(tab))
    on(EVENT.stopLoading, () => this.#patch(tab, { isLoading: false, ...this.#historyFlags(guest) }))
    on(EVENT.navigate, () => this.#patch(tab, this.#historyFlags(guest)))
    on(EVENT.navigateInPage, () => this.#patch(tab, this.#historyFlags(guest)))
    on(EVENT.favicon, (_e, icons) => this.#patch(tab, { faviconUrl: (icons as string[] | undefined)?.[0] ?? null }))
    on(EVENT.failLoad, (_e, code, description, _url, isMainFrame) =>
      this.#onFailLoad(tab, Number(code), String(description), isMainFrame === true),
    )
    on(EVENT.console, (...args) => {
      const entry = normalizeConsoleEvent(args, this.#host.now())
      if (entry) tab.console.push(entry)
    })
    on(EVENT.devtoolsOpened, () => this.#patch(tab, { devToolsOpen: true }))
    on(EVENT.devtoolsClosed, () => this.#patch(tab, { devToolsOpen: false }))
    for (const event of NAV_EVENTS) on(event, (e) => this.#applyPolicy(tab, e as NavigationEventLike))
    guest.setWindowOpenHandler(({ url }) => {
      this.#onWindowOpen(tab, url)
      return DENY
    })
  }

  #onStartLoading(tab: Tab): void {
    const hadError = tab.state.loadError !== null
    this.#patch(tab, { isLoading: true, loadError: null })
    if (hadError) this.#sync()
  }

  #onFailLoad(tab: Tab, code: number, description: string, isMainFrame: boolean): void {
    if (!isMainFrame || code === ERR_ABORTED) return
    this.#patch(tab, { isLoading: false, loadError: { code, description } })
    this.#sync()
  }

  #onWindowOpen(tab: Tab, url: string): void {
    const kind = classifyNavigation(url)
    if (kind === NAVIGATION_CLASS.internal) this.openTab(tab.state.worktreeId, url)
    else if (kind === NAVIGATION_CLASS.external) this.#openExternal(tab, url)
  }

  /** One policy for will-navigate, will-redirect and will-frame-navigate. */
  #applyPolicy(tab: Tab, e: NavigationEventLike): void {
    const kind = classifyNavigation(e.url)
    if (kind === NAVIGATION_CLASS.internal) return
    e.preventDefault()
    if (kind === NAVIGATION_CLASS.external && e.isMainFrame) this.#openExternal(tab, e.url)
  }

  /** At most once per tab per `EXTERNAL_OPEN_MIN_INTERVAL_MS`; denylisted schemes never get here. */
  #openExternal(tab: Tab, url: string): void {
    const now = this.#host.now()
    if (tab.lastExternal && now - tab.lastExternal.at < EXTERNAL_OPEN_MIN_INTERVAL_MS) return
    tab.lastExternal = { url, at: now }
    this.#host.openExternal(url).catch(() => undefined)
  }
}
