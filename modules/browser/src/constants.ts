/** Module-internal constants (§9.2); anything other modules or the E2E need lives in `contract/`. */

export const BROWSER_MODULE_ID = 'browser'

// Right panel, status bar, settings page
export const RIGHT_TAB_ID = 'browser'
export const RIGHT_TAB_ORDER = 20
export const RIGHT_TAB_ICON = 'globe'
export const STATUSBAR_ENTRY_ID = 'browser.devUrl'
export const STATUSBAR_ORDER = 30
export const SETTINGS_PAGE_ICON = 'globe'

// Views and partitions
export const VIEW_ID_PREFIX = 'browser:'
export const PARTITION_PREFIX = 'persist:wt-'
export const PARTITION_UNSAFE_RE = /[^A-Za-z0-9_-]/g
export const PARTITION_REPLACEMENT = '_'

// Picker
export const PICKER_WORLD_ID = 1808
export const PICK_TIMEOUT_MS = 120_000
export const REACT_PROBE_TIMEOUT_MS = 500
export const PICKER_ACCENT_FALLBACK = '#0078d4'
export const ACCENT_TOKEN = 'ac'

// Navigation
export const EXTERNAL_OPEN_MIN_INTERVAL_MS = 1000
export const ERR_ABORTED = -3
export const ABOUT_BLANK = 'about:blank'
export const INTERNAL_PROTOCOLS = ['http:', 'https:'] as const

// Zoom
/** Chromium's zoom ladder, by percent. */
const ZOOM_LEVELS = {
  p50: 0.5,
  p67: 0.67,
  p80: 0.8,
  p90: 0.9,
  p100: 1,
  p110: 1.1,
  p125: 1.25,
  p150: 1.5,
  p175: 1.75,
  p200: 2,
  p250: 2.5,
  p300: 3,
} as const
export const ZOOM_STEPS: readonly number[] = Object.values(ZOOM_LEVELS)
export const DEFAULT_ZOOM = 1
export const PERCENT = 100

// Screenshots
export const SHOTS_DIR = ['tmp', 'shots'] as const
export const PNG_EXT = '.png'
export const MS_PER_DAY = 86_400_000

// Clamping and redaction
export const TRUNCATION_MARKER = (n: number): string => `…[truncated ${n} chars]`
export const REDACTED = '[redacted]'
export const SENSITIVE_PARAM_RE =
  /^(token|access_token|id_token|refresh_token|auth|code|key|api_key|apikey|secret|password|passwd|pwd|session|sessionid|sid|signature|sig)$/i
export const SENSITIVE_ATTR_RE = '^(data-[\\w-]*(token|secret|auth|key|password|session)[\\w-]*)$'
export const HASHY_CLASS_RES = [
  '^css-[a-z0-9]+$',
  '^(sc|jsx|emotion|styled)-[A-Za-z0-9]+$',
  '^_?[A-Za-z0-9]*_[A-Za-z0-9]{5,}$',
  '^(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Z])[A-Za-z0-9]{8,}$',
] as const
export const SELECTOR_MAX_DEPTH = 10
export const DOM_PATH_MAX_DEPTH = 8
export const REACT_MAX_FIBER_DEPTH = 35
export const REACT_MAX_COMPONENTS = 3
export const PROBE_NAME_MAX = 200
export const PROBE_SOURCE_MAX = 300
export const SELECTOR_MAX = 2000
export const TITLE_MAX = 500
export const URL_MAX = 4000
export const STYLE_VALUE_MAX = 300
export const VIEWPORT_MAX_PX = 100_000

// Console
export const CONSOLE_MESSAGE_MAX = 500
export const LEGACY_CONSOLE_LEVELS = ['debug', 'info', 'warning', 'error'] as const

// Security
export const ALLOWED_PERMISSIONS = ['fullscreen', 'clipboard-sanitized-write'] as const

// Address bar
export const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'] as const
export const LOCALHOST = 'localhost'
export const HTTP_PREFIX = 'http://'
export const HTTPS_PREFIX = 'https://'
export const QUERY_PLACEHOLDER = '{query}'
export const HTTP_URL_RE = /^https?:\/\//i
export const PORT_ONLY_RE = /^\d{2,5}(\/.*)?$/
export const COLON_PORT_RE = /^:\d{2,5}/
export const LOCAL_HOST_PREFIX_RE = /^(localhost|127\.0\.0\.1|\[::1\])(?=$|[:/?#])/i
export const SCHEME_RE = /^[a-z][a-z0-9+.-]*:/i
export const HOST_PORT_RE = /^[^/:\s]+:\d+(?=$|[/?#])/
export const WHITESPACE_RE = /\s/
export const DOT = '.'

// Layout (the inset and the DOM rows share these, so they cannot drift)
export const TAB_STRIP_PX = 28
export const TOOLBAR_PX = 32
export const VIEW_INSET_TOP_PX = TAB_STRIP_PX + TOOLBAR_PX
export const POPOVER_WIDTH = 340

// Settings bounds
export const SETTINGS_LIMITS = {
  consoleBufferMax: 5000,
  consoleErrorsMax: 100,
  outerHtmlMax: 100_000,
  textMax: 10_000,
  liveViewsMax: 50,
  retentionDaysMax: 365,
} as const
