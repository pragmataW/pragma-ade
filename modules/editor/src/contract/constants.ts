/** Constants shared by main, renderer, the bridge extension and other modules' E2E (§9.2). */
export const EDITOR_MODULE_ID = 'editor'
export const EDITOR_OPEN_FILE = 'editor.openFile'
export const FILES_TAB_ID = 'files'
export const FILES_TAB_ORDER = 30
export const FILES_TAB_ICON = 'file-code-2'
export const EDITOR_CLIENT_KIND = 'vscode-extension'
export const EDITOR_CLIENT_NAME = 'pragma-bridge'
export const EDITOR_SETTINGS_ORDER = 80
export const EDITOR_STATUSBAR_ORDER = 30
export const EDITOR_STATUSBAR_ENTRY_ID = 'editor.languageStatus'
export const TEST_OPS = [
  'diagnostics',
  'executeCommand',
  'tabs',
  'addComment',
  'extensionActive',
  'activeEditor',
] as const
export type TestOp = (typeof TEST_OPS)[number]
export const TEST_OP = Object.fromEntries(TEST_OPS.map((o) => [o, o])) as { readonly [K in TestOp]: K }
export const COMMENT_ACTIONS = ['send', 'draft'] as const
export type CommentAction = (typeof COMMENT_ACTIONS)[number]
export const COMMENT_ACTION = { send: 'send', draft: 'draft' } as const satisfies Record<string, CommentAction>
export const LANGUAGE_STATES = ['idle', 'ok', 'problems'] as const
export type LanguageState = (typeof LANGUAGE_STATES)[number]
export const LANGUAGE_STATE = { idle: 'idle', ok: 'ok', problems: 'problems' } as const satisfies Record<
  string,
  LanguageState
>
export const COMMENT_REPLY_STATUSES = ['drafted', 'sent', 'needsUserAction', 'failed'] as const
export type CommentReplyStatus = (typeof COMMENT_REPLY_STATUSES)[number]
export const COMMENT_REPLY = {
  drafted: 'drafted',
  sent: 'sent',
  needsUserAction: 'needsUserAction',
  failed: 'failed',
} as const satisfies Record<string, CommentReplyStatus>

export const EDITOR_STATES = [
  'not-installed',
  'downloading',
  'verifying',
  'extracting',
  'starting',
  'ready',
  'error',
] as const
export type EditorState = (typeof EDITOR_STATES)[number]
export const EDITOR_STATE = {
  notInstalled: 'not-installed',
  downloading: 'downloading',
  verifying: 'verifying',
  extracting: 'extracting',
  starting: 'starting',
  ready: 'ready',
  error: 'error',
} as const satisfies Record<string, EditorState>

export const EDITOR_ERROR_KEYS = [
  'checksumMismatch',
  'downloadFailed',
  'invalidArchive',
  'unsupportedPlatform',
  'serverStartFailed',
  'serverCrashed',
  'extensionInstallFailed',
  'openFileFailed',
  'worktreeNotFound',
] as const
export type EditorErrorKey = (typeof EDITOR_ERROR_KEYS)[number]
export const EDITOR_ERROR = Object.fromEntries(EDITOR_ERROR_KEYS.map((k) => [k, k])) as {
  readonly [K in EditorErrorKey]: K
}
/** `editor:errors.<key>`, the i18n key the UI shows. */
export const editorErrorI18nKey = (k: EditorErrorKey) => `editor:errors.${k}` as const
export type EditorErrorI18nKey = ReturnType<typeof editorErrorI18nKey>

export const MAX_OPEN_VIEWS_MIN = 1
export const MAX_OPEN_VIEWS_MAX = 16
export const MAX_OPEN_VIEWS_DEFAULT = 4
export const GRACE_SECONDS_MIN = 10
export const GRACE_SECONDS_MAX = 10_800
export const GRACE_SECONDS_DEFAULT = 300
export const DEFAULT_THEME_MAP = { dark: 'Dark Modern', light: 'Light Modern' } as const

/** IPC channels (`editor.<action>`, §4.3). */
export const EDITOR_IPC = {
  getStatus: 'editor.getStatus',
  ensureReady: 'editor.ensureReady',
  cancelDownload: 'editor.cancelDownload',
  retry: 'editor.retry',
  restartServer: 'editor.restartServer',
  reinstall: 'editor.reinstall',
  getServerInfo: 'editor.getServerInfo',
  getLanguageStatus: 'editor.getLanguageStatus',
  statusChanged: 'editor.statusChanged',
  revealRequested: 'editor.revealRequested',
  languageStatusChanged: 'editor.languageStatusChanged',
} as const

/** `folderKey` normalisation (pure: shared with the extension, no `node:path`). */
export const PATH_SEP = '/'
export const CASE_INSENSITIVE_PLATFORMS = ['darwin', 'win32'] as const
