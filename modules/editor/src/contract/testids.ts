/** `data-testid`s other modules' E2E may use (§10.1.6). */
export const EDITOR_TEST_IDS = {
  filesTab: 'editor-files-tab',
  status: 'editor-status',
  progress: 'editor-download-progress',
  download: 'editor-download',
  cancel: 'editor-cancel',
  retry: 'editor-retry',
  redownload: 'editor-redownload',
  settingsPage: 'editor-settings',
  restartServer: 'editor-restart-server',
  lspStatus: 'editor-lsp-status',
  maxOpenViews: 'editor-settings-max-views',
  themeDark: 'editor-settings-theme-dark',
  themeLight: 'editor-settings-theme-light',
  syncPalette: 'editor-settings-sync-palette',
  serveWebviewsLocally: 'editor-settings-serve-webviews',
  serverInfo: 'editor-settings-server-info',
} as const
