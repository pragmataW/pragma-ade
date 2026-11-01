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
