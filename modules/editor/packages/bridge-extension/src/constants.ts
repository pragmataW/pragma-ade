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
  editor: 'editor',
  fontFamily: 'fontFamily',
  fontSize: 'fontSize',
  lineHeight: 'lineHeight',
  terminal: 'terminal',
  terminalFontFamily: 'integrated.fontFamily',
  iconTheme: 'iconTheme',
  window: 'window',
  autoDetectColorScheme: 'autoDetectColorScheme',
  preferredDarkColorTheme: 'preferredDarkColorTheme',
  preferredLightColorTheme: 'preferredLightColorTheme',
} as const
export const STATE_KEYS = {
  /** Top-level colour ids written by versions before theme-scoped blocks (removed on the next apply). */
  managedColorKeys: 'pragma.managedColorKeys',
  /** `colorCustomizations` scope (`''` top level, `[<theme>]` a theme block) → colour ids Pragma wrote there. */
  managedColors: 'pragma.managedColors',
  defaultsVersion: 'pragma.defaultsVersion',
} as const
/** A theme apply re-reads what it wrote; another workbench writing the same user settings can undo or reject it. */
export const THEME_APPLY = {
  attempts: 5,
  retryDelayMs: 200,
  notApplied: 'Pragma theme not applied: another window keeps overwriting the user settings.',
} as const
export const THEME_SCOPE = { top: '', open: '[', close: ']' } as const
export const DEFAULT_VALUES = {
  none: 'none',
  off: 'off',
  /** The app's code font (`FONT_MONO` in `@pragma/ui`); the app loads it into the workbench. */
  monoFont: "'JetBrains Mono Variable', 'JetBrains Mono', monospace",
  editorFontSize: 12.5,
  editorLineHeight: 20,
  /** `contributes.iconThemes[0].id` in package.json: Material icons, the same set the app's trees draw. */
  iconTheme: 'pragma-material-icons',
} as const
/** The built-in git extension and the commands "Open in editor" (Git Changes) uses. */
export const GIT = {
  extensionId: 'vscode.git',
  apiVersion: 1,
  initialized: 'initialized',
  openChange: 'git.openChange',
  vscodeDiff: 'vscode.diff',
  /** How long to wait for the git extension to finish its first repository scan. */
  readyTimeoutMs: 10_000,
} as const
export const SCM_CHANGE = { opened: 'opened', notChanged: 'notChanged', noRepository: 'noRepository' } as const
export type ScmChangeResult = (typeof SCM_CHANGE)[keyof typeof SCM_CHANGE]
/** Diff tab titles: `name (old ↔ new)`; full shas are shortened. */
export const DIFF_TITLE = {
  separator: ' ↔ ',
  open: ' (',
  close: ')',
  workingTree: 'Working Tree',
  shaLength: 7,
} as const
export const OUTSIDE_FOLDER_WARNING = 'Pragma: the file is outside this worktree and was not opened: '
/** ui-notes palette token → workbench color ids (`workbench.colorCustomizations`). */
export const PALETTE_COLOR_MAP: Record<string, readonly string[]> = {
  bg: [
    'editor.background',
    'tab.activeBackground',
    'editorGutter.background',
    'breadcrumb.background',
    'editorCommentsWidget.replyInputBackground',
  ],
  // Inactive variants too: the workbench is unfocused whenever the app's own UI has focus.
  sb: [
    'sideBar.background',
    'sideBarSectionHeader.background',
    'activityBar.background',
    'titleBar.activeBackground',
    'titleBar.inactiveBackground',
    'statusBar.background',
    'statusBar.noFolderBackground',
  ],
  pn: ['panel.background', 'editorGroupHeader.tabsBackground', 'tab.inactiveBackground'],
  el: ['input.background', 'dropdown.background', 'editorWidget.background', 'commandCenter.background'],
  hv: ['list.hoverBackground', 'list.activeSelectionBackground', 'list.inactiveSelectionBackground'],
  bd: [
    'panel.border',
    'sideBar.border',
    'editorGroup.border',
    'tab.border',
    'titleBar.border',
    'activityBar.border',
    'statusBar.border',
    'commandCenter.border',
    // The comment widget's frame: a neutral card border like the app's threads (the header shows the status).
    'editorCommentsWidget.resolvedBorder',
    'editorCommentsWidget.unresolvedBorder',
  ],
  bd2: ['input.border'],
  tx: [
    'foreground',
    'editor.foreground',
    'titleBar.activeForeground',
    'commandCenter.foreground',
    'activityBar.foreground',
    'sideBar.foreground',
    'statusBar.foreground',
    'list.activeSelectionForeground',
    'list.inactiveSelectionForeground',
  ],
  mu: [
    'descriptionForeground',
    'titleBar.inactiveForeground',
    'commandCenter.inactiveForeground',
    'activityBar.inactiveForeground',
  ],
  ac: [
    'focusBorder',
    'button.background',
    'badge.background',
    'activityBarBadge.background',
    'tab.activeBorderTop',
    'progressBar.background',
    'activityBar.activeBorder',
    'panelTitle.activeBorder',
    'statusBarItem.remoteBackground',
  ],
  acfg: ['button.foreground', 'badge.foreground', 'activityBarBadge.foreground', 'statusBarItem.remoteForeground'],
  act: ['textLink.foreground'],
  acs: [
    'editor.selectionHighlightBackground',
    'editorCommentsWidget.rangeBackground',
    'editorCommentsWidget.rangeActiveBackground',
  ],
  // Shared status tokens → colours the manifest contributes for the comment widget skin.
  warn: ['pragma.comment.pendingBorder'],
  ok: ['pragma.comment.resolvedForeground'],
}
export const COMMANDS = {
  sendToAgent: 'pragma.comment.sendToAgent',
  addToReview: 'pragma.comment.addToReview',
  cancel: 'pragma.comment.cancel',
  reply: 'pragma.thread.reply',
  replyAndSend: 'pragma.thread.replyAndSend',
  /** Closes the reply box (the workbench collapses it after any form action). */
  replyCancel: 'pragma.thread.replyCancel',
  resolve: 'pragma.thread.resolve',
  reopen: 'pragma.thread.reopen',
  deleteThread: 'pragma.thread.delete',
  /** Removes a composer whose comment could not be stored ("Not sent"). */
  discard: 'pragma.thread.discard',
} as const
export const CONTROLLER = {
  id: 'pragma-review',
  label: 'Pragma',
  /** Placeholder of the new-comment and the reply editor. */
  placeHolder: 'Write a comment for the agent…',
  /** Text of a thread's collapsed reply button (one click opens the reply editor). */
  prompt: 'Reply',
} as const
export const FILE_SCHEME = 'file'
export const PLAINTEXT = 'plaintext'
export const COMMENT_MESSAGES = {
  empty: 'Comment is empty',
  outside: 'Only files in this worktree can be commented',
  drafted: 'Added to drafts',
  sent: 'Sent to agent',
  needsUserAction: 'Choose an agent in Pragma',
  notSentLabel: 'Not sent',
  pendingLabel: 'Pending',
  author: 'You',
  agent: 'Agent',
  replied: 'Reply added',
  notStored: 'This thread is not stored in Pragma',
} as const
/** `CommentThread.contextValue`: stored threads, and a composer whose comment was not stored (the title menus key on it). */
export const THREAD_CONTEXT = {
  open: 'pragma-thread-open',
  resolved: 'pragma-thread-resolved',
  unsent: 'pragma-thread-unsent',
} as const
/** `Comment.contextValue` of a drawn comment: not delivered by a Send yet, or delivered / from the agent. */
export const COMMENT_CONTEXT = { pending: 'pragma-comment-pending', sent: 'pragma-comment' } as const
/** Thread header text, as Git Changes writes a location: `L3` / `L3–5`, then the status and Pending. */
export const THREAD_LABEL = { line: 'L', range: '–', sep: ' · ', open: 'Open', resolved: 'Resolved' } as const
export const CONNECTION = { connected: 'connected', disabled: 'disabled' } as const
/** Index = `vscode.DiagnosticSeverity` (Error 0, Warning 1, Information 2, Hint 3). */
export const SEVERITIES = ['error', 'warning', 'info', 'hint'] as const
export type Severity = (typeof SEVERITIES)[number]
export const SEVERITY = { error: 'error', warning: 'warning' } as const satisfies Record<string, Severity>
export const TAB_KINDS = { text: 'text', diff: 'diff', webview: 'webview', other: 'other' } as const
export type TabKind = (typeof TAB_KINDS)[keyof typeof TAB_KINDS]
export const LANGUAGE_STATUS_DEBOUNCE_MS = 300
export const TEST_MODE = { env: 'PRAGMA_TEST', enabled: '1' } as const
export const TEST_ARG = {
  id: 'id',
  send: 'send',
  status: 'status',
  path: 'path',
  lineStart: 'lineStart',
  lineEnd: 'lineEnd',
  body: 'body',
} as const
export const TEST_RESPONSE = 'testResponse'
/** The `editor` bridge request and event carrying the worktree's review threads. */
export const THREADS_MESSAGE = 'threads'
