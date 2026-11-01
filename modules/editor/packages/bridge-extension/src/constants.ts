/** Extension-local constants (§9.2); shared names come from `@pragma/module-editor/contract`. */
export const LOG_CHANNEL = 'Pragma Bridge'
export const MESSAGES = {
  disabledNoFolder: 'Pragma bridge disabled: no workspace folder.',
  disabledNoBridge: 'Pragma bridge disabled: no bridge configuration.',
  connected: 'Pragma bridge connected.',
  helloFailed: 'Pragma bridge hello failed: ',
  offline: 'Pragma bridge is not connected.',
} as const
export const RECONNECT = { enabled: true } as const
export const CONFIG = {
  workbench: 'workbench',
  colorTheme: 'colorTheme',
  colorCustomizations: 'colorCustomizations',
  startupEditor: 'startupEditor',
  enableExperiments: 'enableExperiments',
  tipsEnabled: 'tips.enabled',
  telemetry: 'telemetry',
  telemetryLevel: 'telemetryLevel',
  update: 'update',
  mode: 'mode',
  extensions: 'extensions',
  autoUpdate: 'autoUpdate',
} as const
export const STATE_KEYS = {
  managedColorKeys: 'pragma.managedColorKeys',
  defaultsVersion: 'pragma.defaultsVersion',
} as const
export const DEFAULT_VALUES = { none: 'none', off: 'off' } as const
export const OUTSIDE_FOLDER_WARNING = 'Pragma: the file is outside this worktree and was not opened: '
/** ui-notes palette token → workbench color ids (`workbench.colorCustomizations`). */
export const PALETTE_COLOR_MAP: Record<string, readonly string[]> = {
  bg: ['editor.background', 'tab.activeBackground', 'editorGutter.background'],
  sb: ['sideBar.background', 'activityBar.background', 'titleBar.activeBackground', 'statusBar.background'],
  pn: ['panel.background', 'editorGroupHeader.tabsBackground', 'tab.inactiveBackground'],
  el: ['input.background', 'dropdown.background', 'editorWidget.background'],
  hv: ['list.hoverBackground', 'list.activeSelectionBackground'],
  bd: ['panel.border', 'sideBar.border', 'editorGroup.border', 'tab.border'],
  bd2: ['input.border'],
  tx: ['foreground', 'editor.foreground'],
  mu: ['descriptionForeground'],
  ac: [
    'focusBorder',
    'button.background',
    'badge.background',
    'activityBarBadge.background',
    'tab.activeBorderTop',
    'progressBar.background',
  ],
  acfg: ['button.foreground', 'badge.foreground', 'activityBarBadge.foreground'],
  act: ['textLink.foreground'],
  acs: ['editor.selectionHighlightBackground'],
}
export const COMMANDS = {
  sendToAgent: 'pragma.comment.sendToAgent',
  addToReview: 'pragma.comment.addToReview',
  cancel: 'pragma.comment.cancel',
} as const
export const CONTROLLER = {
  id: 'pragma-review',
  label: 'Pragma',
  placeHolder: 'Comment for the agent',
  prompt: 'Sends file, line range and code excerpt',
} as const
export const FILE_SCHEME = 'file'
export const PLAINTEXT = 'plaintext'
export const COMMENT_MESSAGES = {
  empty: 'Comment is empty',
  outside: 'Only files in this worktree can be commented',
  drafted: 'Added to review',
  sent: 'Sent to agent',
  needsUserAction: 'Choose an agent in Pragma',
  notSentLabel: 'Not sent',
  author: 'You',
} as const
export const CONNECTION = { connected: 'connected', disabled: 'disabled' } as const
/** Index = `vscode.DiagnosticSeverity` (Error 0, Warning 1, Information 2, Hint 3). */
export const SEVERITIES = ['error', 'warning', 'info', 'hint'] as const
export type Severity = (typeof SEVERITIES)[number]
export const SEVERITY = { error: 'error', warning: 'warning' } as const satisfies Record<string, Severity>
export const TAB_KINDS = { text: 'text', webview: 'webview', other: 'other' } as const
export type TabKind = (typeof TAB_KINDS)[keyof typeof TAB_KINDS]
export const LANGUAGE_STATUS_DEBOUNCE_MS = 300
export const TEST_MODE = { env: 'PRAGMA_TEST', enabled: '1' } as const
export const TEST_ARG = {
  id: 'id',
  path: 'path',
  lineStart: 'lineStart',
  lineEnd: 'lineEnd',
  body: 'body',
} as const
export const TEST_RESPONSE = 'testResponse'
