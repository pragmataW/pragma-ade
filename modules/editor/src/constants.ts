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
