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
