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
import { buildDomPath, buildSelector, selectorKit } from '../../src/main/picker/page/selector'
import type { CollectOpts, PickerGlobal, PickerLib, SelectorOpts } from '../../src/main/picker/page/types'

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
