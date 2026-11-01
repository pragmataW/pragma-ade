/** `data-testid`s other modules' E2E tests may use (§10.1.6). */
export const TerminalTestIds = {
  view: 'terminal-view',
  /** The view's banner (exited / not available / error). */
  status: 'terminal-status',
  panel: 'terminal-panel',
  empty: 'terminal-empty',
  tab: (id: string) => `terminal-tab-${id}`,
  tabStatus: 'terminal-tab-status',
  tabRename: 'terminal-tab-rename',
  newTab: 'terminal-new-tab',
  splitVertical: 'terminal-split-vertical',
  splitHorizontal: 'terminal-split-horizontal',
  /** One pane of a tab (`data-active` marks the focused one). */
  pane: 'terminal-pane',
  paneClose: 'terminal-pane-close',
  searchBar: 'terminal-search-bar',
  searchInput: 'terminal-search-input',
  searchResults: 'terminal-search-results',
} as const
