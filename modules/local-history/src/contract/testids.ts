/** `data-testid`s other modules' E2E tests may use (§10.1.6). */
export const LOCAL_HISTORY_TESTIDS = {
  tab: 'local-history-tab',
  empty: 'local-history-empty',
  entry: (id: number) => `local-history-entry-${id}`,
  entryToggle: (id: number) => `local-history-entry-toggle-${id}`,
  restoreEntry: (id: number) => `local-history-restore-${id}`,
  removeEntry: (id: number) => `local-history-remove-${id}`,
  file: (id: number, path: string) => `local-history-file-${id}-${path}`,
  restoreFile: (id: number, path: string) => `local-history-restore-file-${id}-${path}`,
  preview: 'local-history-preview',
  clear: 'local-history-clear',
  retentionDays: 'local-history-retention-days',
  maxTotalMb: 'local-history-max-total-mb',
} as const
