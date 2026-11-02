/** Module-local constants (§9.2). Shared ones live in `src/contract/constants.ts`. */
export const EDITOR_DIR = 'editor'
export const DOWNLOADS_DIR = 'downloads'
export const STATE_FILE = 'state.json'
export const TOKEN_FILE = 'connection-token'
export const BRIDGE_MARKER_FILE = 'bridge-extension.json'
export const SERVER_SUBDIRS = { server: 'server', data: 'data', extensions: 'extensions' } as const
export const HOST = '127.0.0.1'
export const VIEW_ID_PREFIX = 'editor.wt.'
export const EDITOR_PARTITION = 'persist:pragma-editor'
export const BRIDGE_VSIX_REL_PATH = 'packages/bridge-extension/dist/pragma-bridge.vsix'
export const BRIDGE_VSIX_MANIFEST_REL_PATH = 'packages/bridge-extension/dist/manifest.json'
/** Read only when `ctx.testMode`. */
export const TEST_ENV = {
  releaseOverride: 'PRAGMA_EDITOR_RELEASE_OVERRIDE',
  downloadCache: 'PRAGMA_EDITOR_DOWNLOAD_CACHE',
  serverRoot: 'PRAGMA_EDITOR_SERVER_ROOT',
  bridgeVsix: 'PRAGMA_EDITOR_BRIDGE_VSIX',
} as const

export const PINNED_VERSION = '1.143.17232'
export const RELEASE_BASE_URL = `https://github.com/VSCodium/vscodium/releases/download/${PINNED_VERSION}/`
export const SERVER_BIN = { posix: 'bin/codium-server', win32: 'bin/codium-server.cmd' } as const
export const ARCHIVE_STRIP_COMPONENTS = 0
export const ASSET_KEY_SEPARATOR = '-'
export const WIN32 = 'win32'

export const PROGRESS_INTERVAL_MS = 100
export const READY_TIMEOUT_MS = 30_000
export const PART_SUFFIX = '.part'
export const HASH_ALGORITHM = 'sha256'
export const HEX = 'hex'
export const CONTENT_LENGTH = 'content-length'
export const ABORT_ERROR = 'AbortError'
export const INSTALL_MARKER = '.pragma-installed.json'
export const TMP_DIR_INFIX = '.tmp-'
export const RANDOM_SUFFIX_BYTES = 6
export const EXEC_MODE = 0o755
export const JSON_INDENT = 2
export const UTF8 = 'utf8'
export const DOWNLOAD_FAILURE = {
  checksumMismatch: 'checksumMismatch',
  aborted: 'aborted',
  http: 'http',
  network: 'network',
} as const
export const UNSUPPORTED_PLATFORM = 'unsupportedPlatform'
export const PORT_RETRIES = 5
export const PORT_RETRY_DELAY_MS = 300
export const TOKEN_BYTES = 32
export const PRIVATE_FILE_MODE = 0o600
export const SERVER_FLAGS = {
  host: '--host',
  port: '--port',
  connectionTokenFile: '--connection-token-file',
  acceptLicense: '--accept-server-license-terms',
  telemetryLevel: '--telemetry-level',
  disableWorkspaceTrust: '--disable-workspace-trust',
  serverDataDir: '--server-data-dir',
  userDataDir: '--user-data-dir',
  extensionsDir: '--extensions-dir',
  graceTime: '--reconnection-grace-time',
  installExtension: '--install-extension',
  force: '--force',
} as const
export const TELEMETRY_OFF = 'off'
export const NODE_EVENT = { error: 'error', data: 'data', end: 'end', exit: 'exit', close: 'close' } as const
export const HEALTH_INTERVAL_MS = 15_000
export const HEALTH_FAILURES = 2
export const HEALTH_TIMEOUT_MS = 3000
export const READY_POLL_MS = 200
export const MAX_CRASHES = 3
export const CRASH_WINDOW_MS = 60_000
const BACKOFF_FIRST_MS = 1000
const BACKOFF_SECOND_MS = 2000
const BACKOFF_THIRD_MS = 4000
export const BACKOFF_MS = [BACKOFF_FIRST_MS, BACKOFF_SECOND_MS, BACKOFF_THIRD_MS] as const
export const STOP_TIMEOUT_MS = 5000
export const SERVER_LOG_PREFIX = '[codium-server]'
export const TOKEN_IN_URL_RE = /tkn=[^&\s]+/g
export const TOKEN_REDACTED = 'tkn=<redacted>'
export const VERSION_PATH = '/version'
export const SIGNALS = { term: 'SIGTERM', kill: 'SIGKILL' } as const
export const TASKKILL = { command: 'taskkill', args: ['/T', '/F', '/PID'] } as const
export const PIPED_STDIO: ['ignore', 'pipe', 'pipe'] = ['ignore', 'pipe', 'pipe']
export const SERVER_EVENT = { ready: 'ready', restarting: 'restarting', failed: 'failed', stopped: 'stopped' } as const
export const URL_PARAMS = { folder: 'folder', token: 'tkn' } as const
export const WIN_DRIVE_PATH_RE = /^[A-Za-z]:[\\/]/
export const BACKSLASH_RE = /\\/g
export const WEBVIEW_PRE_PATH = '/out/vs/workbench/contrib/webview/browser/pre/'
export const WEBVIEW_CDN_HOST_SUFFIX = '.vscode-cdn.net'
export const EDITOR_ALLOWED_PERMISSIONS = ['clipboard-read', 'clipboard-sanitized-write'] as const
export const EXTERNAL_PROTOCOLS = ['http:', 'https:'] as const
export const HTTPS_SCHEME = 'https'
export const HTTPS_PROTOCOL = 'https:'
export const PARENT_SEGMENT = '..'
export const CONTENT_TYPE = 'content-type'
export const MIME_BY_EXT: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
}
export const MIME_DEFAULT = 'application/octet-stream'
export const WC_EVENTS = { willNavigate: 'will-navigate', domReady: 'dom-ready' } as const
/** Where the workbench sets `--monaco-font` / `--monaco-monospace-font`: its container and the platform classes. */
export const WORKBENCH_FONT_SELECTORS = ['.monaco-workbench', '.mac', '.windows', '.linux'] as const
/** fontsource (Google Fonts) subset ranges; latin-ext has Turkish (ğ ş İ). */
export const FONT_UNICODE_RANGE = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  latinExt:
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
} as const
/** The variable fonts' `wght` axes. */
export const FONT_WEIGHT_RANGE = { sans: '100 900', mono: '100 800' } as const
export const DATA_URL_BASE64_MARKER = ';base64,'
export const WINDOW_OPEN = { openExternal: 'openExternal', deny: 'deny' } as const
export const OPEN_FILE_READY_TIMEOUT_MS = 30_000
export const TEST_REQUEST_TIMEOUT_MS = 30_000
export const BRIDGE_EXTENSION_DIR_PREFIX = 'pragma.pragma-bridge-'
export const EXTENSION_INSTALL_TIMEOUT_MS = 120_000
export const NOT_A_WORKTREE = 'This folder is not a Pragma worktree'
export const BRIDGE_ERRORS = { notReady: 'notReady', timeout: 'timeout' } as const
export const CLIENT_EVENT = { disconnected: 'disconnected' } as const
export const SERVER_STOP_ON_QUIT_MS = 2000
export const TEST_GLOBAL_ACCELERATOR = 'CmdOrCtrl+Alt+Shift+9'
export const TEST_PROBE = { shortcutId: 'editor.test.globalProbe', command: 'editor.test.globalProbeHit' } as const
export const TEST_HOOKS_GLOBAL = '__pragmaEditorTest'
export const SHORTCUT_SCOPE_GLOBAL = 'global' as const
export const EXIT_EVENT = 'exit'
export const BYTES_PER_MB = 1_048_576
export const PERCENT = 100
export const MB_FRACTION_DIGITS = 1
export const RENDERER_ICONS = { spinner: 'loader-circle', error: 'circle-alert', check: 'check' } as const
export const STATUS_ICON_PX = 16
/** Error keys whose fix may be a fresh download (Re-download is offered). */
export const REDOWNLOAD_ERROR_KEYS = ['editor:errors.checksumMismatch', 'editor:errors.invalidArchive'] as const
/** ui-notes token the workbench views are painted with before their page paints. */
export const VIEW_BACKGROUND_TOKEN = 'bg'
