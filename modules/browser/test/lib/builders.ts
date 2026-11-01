/** Shared builders for the browser module's unit tests (§9.1: no copy-pasted setup). */
import type { BrowserPick, BrowserSnapshot, BrowserTabState } from '../../src/contract'

export const SEARCH_URL = 'https://duckduckgo.com/?q={query}'

export function buildTab(over: Partial<BrowserTabState> = {}): BrowserTabState {
  return {
    id: 't1',
    worktreeId: 'wtA',
    url: 'http://localhost:3000/',
    title: 'Home',
    faviconUrl: null,
    isLoading: false,
    canGoBack: false,
    canGoForward: false,
    zoomFactor: 1,
    devToolsOpen: false,
    discarded: false,
    loadError: null,
    ...over,
  }
}

/** A snapshot of the given tabs (grouped by worktree, last tab of each worktree active). */
export function buildSnapshot(
  tabs: BrowserTabState[] = [buildTab()],
  over: Partial<BrowserSnapshot> = {},
): BrowserSnapshot {
  const worktrees: BrowserSnapshot['worktrees'] = {}
  for (const tab of tabs) {
    const entry = worktrees[tab.worktreeId] ?? { tabIds: [], activeTabId: null }
    entry.tabIds.push(tab.id)
    entry.activeTabId = tab.id
    worktrees[tab.worktreeId] = entry
  }
  return {
    activeWorktreeId: tabs[0]?.worktreeId ?? null,
    worktrees,
    tabs: Object.fromEntries(tabs.map((t) => [t.id, t])),
    pickerArmedTabId: null,
    ...over,
  }
}

export function buildPick(over: Partial<BrowserPick> = {}): BrowserPick {
  return {
    pickId: 'p1',
    tabId: 't1',
    worktreeId: 'wtA',
    url: 'http://localhost:3000/',
    title: 'Home',
    selector: '#save',
    domPath: 'body > main > button#save',
    tagName: 'button',
    outerHtml: '<button id="save">Save</button>',
    text: 'Save',
    rect: { x: 10, y: 20, width: 80, height: 24 },
    viewport: { width: 800, height: 600 },
    styles: { color: 'rgb(0, 0, 0)' },
    component: null,
    screenshotPath: '/tmp/shots/p1.png',
    consoleErrors: ['[error] boom (http://localhost:3000/a.js:3)'],
    ...over,
  }
}

// ── In-page picker (jsdom) ───────────────────────────────────────────────────────────────────────────────────────
import {
  DOM_PATH_MAX_DEPTH,
  HASHY_CLASS_RES,
  REDACTED,
  SELECTOR_MAX_CLASSES,
  SELECTOR_MAX_DEPTH,
  SENSITIVE_ATTR_RE,
  TRUNCATION_TEMPLATE,
} from '../../src/constants'
import { collectElementContext } from '../../src/main/picker/page/collect'
import { installPicker } from '../../src/main/picker/page/overlay'
import { buildDomPath, buildSelector, selectorKit } from '../../src/main/picker/page/selector'
import type { CollectOpts, PickerGlobal, PickerLib, SelectorOpts } from '../../src/main/picker/page/types'
import type { PickerScriptOpts } from '../../src/main/picker/script'

export const SEL: SelectorOpts = {
  maxDepth: SELECTOR_MAX_DEPTH,
  domPathMaxDepth: DOM_PATH_MAX_DEPTH,
  maxClasses: SELECTOR_MAX_CLASSES,
  hashyClassPatterns: [...HASHY_CLASS_RES],
}
export const OPTS: CollectOpts = {
  ...SEL,
  outerHtmlMax: 2000,
  textMax: 200,
  styleProps: ['display', 'color', 'width'],
  redacted: REDACTED,
  sensitiveAttrPattern: SENSITIVE_ATTR_RE,
  truncationTemplate: TRUNCATION_TEMPLATE,
}

/** Installs `globalThis.__pragmaPickerLib` the way the injected script does. */
export function installLib(extra: Partial<PickerLib> = {}): void {
  ;(globalThis as PickerGlobal).__pragmaPickerLib = {
    selectorKit,
    buildSelector,
    buildDomPath,
    collectElementContext,
    installPicker,
    ...extra,
  } as PickerLib
}

/** Replaces the body with `html` (and installs the lib). */
export function mount(html: string): void {
  document.body.innerHTML = html
  installLib()
}

export const q = <E extends Element = HTMLElement>(sel: string): E => {
  const el = document.querySelector<E>(sel)
  if (!el) throw new Error(`no element ${sel}`)
  return el
}

/** ~40 nodes: repeated cards, duplicate classes, no ids. */
export const NESTED_FIXTURE = `
<header class="top"><nav><a class="link">a</a><a class="link">b</a><a class="link active">c</a></nav></header>
<main>
  ${[1, 2, 3]
    .map(
      () => `<section class="card"><h2 class="title">T</h2><ul class="list"><li class="item">x</li><li class="item">y</li>
        <li class="item"><span>z</span><span class="badge">!</span></li></ul><div><div><p>deep</p></div></div></section>`,
    )
    .join('')}
  <div class="card"><p class="title">odd</p></div>
</main>
<footer><p>f</p><p>g</p></footer>`

export const SCRIPT_OPTS: PickerScriptOpts = {
  ...OPTS,
  nonce: 'nonce-1',
  accent: '#0078d4',
  hint: 'Pick',
  pickAttr: 'data-pragma-pick',
}

/** Evaluates a built script the way Electron does (one expression). */
export const run = <T>(code: string): T => new window.Function(`return (${code})`)() as T

/** Points the (layout-less) document at `el` and sends the hover + press sequence a real click produces. */
export function hoverAndClick(el: Element, opts: { click?: boolean } = {}): void {
  document.elementsFromPoint = () => [el]
  const init = { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }
  el.dispatchEvent(new MouseEvent('mousemove', init))
  if (opts.click === false) return
  for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) el.dispatchEvent(new MouseEvent(type, init))
}

/** Removes the picker, its marks and both globals. */
export function resetPicker(): void {
  const g = globalThis as PickerGlobal
  g.__pragmaPicker?.teardown()
  delete g.__pragmaPicker
  delete g.__pragmaPickerLib
}

export interface FakeFiberSpec {
  name: string
  debugSource?: { fileName: string; lineNumber: number; columnNumber?: number }
  debugStack?: string
}

/** A host fiber (`button`) whose parent is a component fiber named `name`. */
export function fakeFiber(spec: FakeFiberSpec): object {
  const type = { [spec.name]: () => null }[spec.name]
  const component = { type, return: null, _debugSource: spec.debugSource, _debugStack: spec.debugStack }
  return { type: 'button', return: component }
}

export function attachFiber(el: Element, fiber: object | null, nonce: string): void {
  if (fiber) Object.assign(el, { __reactFiber$abc123: fiber })
  el.setAttribute('data-pragma-pick', nonce)
}

// ── Main side: fake guest, host and manager ──────────────────────────────────────────────────────────────────
import type { Rect } from '@pragma/sdk'
import type { BrowserSettings as Settings } from '../../src/contract'
import type { BrowserHost, GuestLike, ImageLike, ViewLike } from '../../src/main/guest'
import { browserSettingsDefaults } from '../../src/main/settings'
import { BrowserTabManager } from '../../src/main/tab-manager'

export type IsolatedReply = unknown | ((code: string) => unknown)

export interface FakeGuest extends GuestLike {
  calls: string[]
  loaded: string[]
  url: string
  devtools: boolean
  zoomFactor: number
  history: { back: boolean; forward: boolean }
  destroyed: boolean
  windowOpen?: (d: { url: string }) => { action: 'deny' }
  /** Fires the listeners of `event`. */
  emit(event: string, ...args: unknown[]): void
  /** Replies of `executeJavaScriptInIsolatedWorld`, in order; when empty the call resolves to true. */
  isolatedReplies: IsolatedReply[]
  isolatedCalls: { worldId: number; code: string }[]
  mainWorldCalls: string[]
  mainWorldReply: unknown
  capture: { image: ImageLike | null; error?: Error }
}

let guestIds = 0

export function fakeImage(size = { width: 800, height: 600 }, empty = false): ImageLike & { crops: Rect[] } {
  const crops: Rect[] = []
  return {
    crops,
    isEmpty: () => empty,
    getSize: () => size,
    crop(rect) {
      crops.push(rect)
      return this
    },
    toPNG: () => Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
  }
}

export function fakeGuest(): FakeGuest {
  const listeners = new Map<string, ((...a: unknown[]) => void)[]>()
  const g: FakeGuest = {
    id: ++guestIds,
    calls: [],
    loaded: [],
    url: '',
    devtools: false,
    zoomFactor: 1,
    history: { back: false, forward: false },
    destroyed: false,
    isolatedReplies: [],
    isolatedCalls: [],
    mainWorldCalls: [],
    mainWorldReply: null,
    capture: { image: fakeImage() },
    emit(event, ...args) {
      for (const cb of listeners.get(event) ?? []) cb(...args)
    },
    async loadURL(url) {
      g.loaded.push(url)
      g.url = url
    },
    getURL: () => g.url,
    getTitle: () => '',
    isLoading: () => false,
    navigationHistory: {
      canGoBack: () => g.history.back,
      canGoForward: () => g.history.forward,
      goBack: () => void g.calls.push('goBack'),
      goForward: () => void g.calls.push('goForward'),
    },
    reload: () => void g.calls.push('reload'),
    stop: () => void g.calls.push('stop'),
    setZoomFactor(f) {
      g.zoomFactor = f
    },
    getZoomFactor: () => g.zoomFactor,
    openDevTools() {
      g.devtools = true
    },
    closeDevTools() {
      g.devtools = false
    },
    isDevToolsOpened: () => g.devtools,
    setWindowOpenHandler(h) {
      g.windowOpen = h
    },
    on(event, cb) {
      listeners.set(event, [...(listeners.get(event) ?? []), cb])
    },
    isDestroyed: () => g.destroyed,
    close() {
      g.calls.push('close')
      g.destroyed = true
      g.emit('destroyed')
    },
    async executeJavaScript(code) {
      g.mainWorldCalls.push(code)
      return g.mainWorldReply
    },
    async executeJavaScriptInIsolatedWorld(worldId, scripts) {
      const code = scripts[0]?.code ?? ''
      g.isolatedCalls.push({ worldId, code })
      const reply = g.isolatedReplies.length ? g.isolatedReplies.shift() : true
      return typeof reply === 'function' ? (reply as (c: string) => unknown)(code) : reply
    },
    async capturePage() {
      if (g.capture.error) throw g.capture.error
      return g.capture.image ?? fakeImage({ width: 0, height: 0 }, true)
    },
  }
  return g
}

export interface FakeHost extends BrowserHost {
  calls: string[]
  guests: FakeGuest[]
  externals: string[]
  clock: number
  /** The guest of the view attached as `browser:<tabId>`. */
  guestOf(tabId: string): FakeGuest
}

export function fakeHost(): FakeHost {
  const byView = new Map<string, FakeGuest>()
  const host: FakeHost = {
    calls: [],
    guests: [],
    externals: [],
    clock: 1_000_000,
    createView(partition) {
      host.calls.push(`createView:${partition}`)
      const guest = fakeGuest()
      host.guests.push(guest)
      return { webContents: guest }
    },
    attach(viewId, view: ViewLike) {
      host.calls.push(`attach:${viewId}`)
      byView.set(viewId, view.webContents as FakeGuest)
      return { dispose: () => host.detach(viewId) }
    },
    detach: (viewId) => void host.calls.push(`detach:${viewId}`),
    show: (viewId) => void host.calls.push(`show:${viewId}`),
    hide: (viewId) => void host.calls.push(`hide:${viewId}`),
    freeze: async (viewId) => void host.calls.push(`freeze:${viewId}`),
    unfreeze: async (viewId) => void host.calls.push(`unfreeze:${viewId}`),
    async openExternal(url) {
      host.externals.push(url)
    },
    clearPartition: async (p) => void host.calls.push(`clearPartition:${p}`),
    now: () => host.clock,
    guestOf(tabId) {
      const g = byView.get(`browser:${tabId}`)
      if (!g) throw new Error(`no guest for ${tabId}`)
      return g
    },
  }
  return host
}

export const flush = () => new Promise<void>((r) => setTimeout(r, 0))

/** A manager over a fake host; `emits` collects every published snapshot. */
export function setupManager(over: Partial<Settings> = {}) {
  const host = fakeHost()
  const settings: Settings = { ...browserSettingsDefaults, ...over }
  const emits: BrowserSnapshot[] = []
  const manager = new BrowserTabManager(
    host,
    () => settings,
    (s) => emits.push(s),
  )
  const last = async (): Promise<BrowserSnapshot> => {
    await flush()
    const s = emits.at(-1)
    if (!s) throw new Error('no snapshot emitted')
    return s
  }
  return { host, settings, manager, emits, last }
}

/** A navigation event like Electron's `will-*` events. */
export const navEvent = (url: string, isMainFrame = true) => {
  const e = {
    url,
    isMainFrame,
    prevented: false,
    preventDefault() {
      e.prevented = true
    },
  }
  return e
}
