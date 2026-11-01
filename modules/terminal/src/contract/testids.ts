/** `data-testid`s other modules' E2E tests may use (§10.1.6). */
export const TerminalTestIds = {
  view: 'terminal-view',
  /** The view's banner (exited / not available / error). */
  status: 'terminal-status',
  panel: 'terminal-panel',
  empty: 'terminal-empty',
} as const
