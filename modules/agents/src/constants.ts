/** Module-internal constants (§9); shared ones live in `contract/constants.ts`. */

export const TABLES = { profiles: 'agents_profiles', sessions: 'agents_sessions' } as const
export const COLUMNS = {
  id: 'id',
  providerId: 'provider_id',
  name: 'name',
  command: 'command',
  args: 'args',
  envJson: 'env_json',
  enabled: 'enabled',
  isDefault: 'is_default',
  isBuiltin: 'is_builtin',
  sortOrder: 'sort_order',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  worktreeId: 'worktree_id',
  profileId: 'profile_id',
  mode: 'mode',
  ptyId: 'pty_id',
  title: 'title',
  ordinal: 'ordinal',
  status: 'status',
  externalSessionId: 'external_session_id',
  exitCode: 'exit_code',
  errorCode: 'error_code',
  errorMessage: 'error_message',
  endedAt: 'ended_at',
  closedAt: 'closed_at',
  lastFocusedAt: 'last_focused_at',
} as const
export const EMPTY_ENV_JSON = '{}'
export const LAUNCH_CAPABILITY = 'launch'
/** New custom profiles go after the last one. */
export const SORT_ORDER_STEP = 10
/** Session titles derived from the first prompt line. */
export const TITLE_MAX_CHARS = 40
export const ELLIPSIS = '…'
/** Per-session temp dirs live under `<userData>/agents/tmp`; dirs are 0700, files 0600. */
export const TEMP_ROOT_SEGMENTS = ['agents', 'tmp'] as const
export const TEMP_DIR_MODE = 0o700
export const TEMP_FILE_MODE = 0o600
/** stopSession: SIGTERM, wait, SIGKILL, wait; never resolves on a timeout alone. */
export const STOP_GRACE_MS = 5000
export const KILL_CONFIRM_MS = 5000
export const DEFAULT_PTY_COLS = 120
export const DEFAULT_PTY_ROWS = 32
/** Tag key carrying the session id on agent ptys (the owner tag is the terminal contract's). */
export const PTY_TAG_SESSION = 'sessionId'
export const SIGTERM = 'SIGTERM'
export const SIGKILL = 'SIGKILL'
/** Profile checks (`--version` probes): advisory, bounded, cached. */
export const CHECK_TIMEOUT_MS = 5000
export const EXEC_OUTPUT_CAP_BYTES = 65_536
export const CHECK_CACHE_TTL_MS = 60_000
/** PRAGMA_TEST hooks. */
export const TEST_OUTPUT_CAP_BYTES = 262_144
export const WAIT_STATUS_MS = 10_000
export const WAIT_POLL_MS = 50
/** Renderer: provider mark sizes (ui-notes "Agent marks"), debounce, branch slug. */
export const MARK_TAB = 18
export const MARK_CARD = 20
export const MARK_LARGE = 32
export const COMMAND_CHECK_DEBOUNCE_MS = 400
export const BRANCH_PREFIX = 'agent/'
export const BRANCH_SLUG_MAX = 40
export const FALLBACK_MARK_ICON = 'bot'
export const ICON_SM = 14
/** Lucide icon names (kebab-case, drawn with `<Icon name>`). */
export const ICONS = {
  failed: 'circle-alert',
  ended: 'circle-stop',
  warning: 'triangle-alert',
  close: 'x',
  add: 'plus',
  menu: 'ellipsis',
  bot: 'bot',
  expand: 'chevron-down',
  collapse: 'chevron-up',
  remove: 'trash-2',
  check: 'circle-check',
} as const
/** The launcher shortcut, registered from main (renderer registrations would collide after a renderer reload). */
export const OPEN_LAUNCHER_SHORTCUT = { accelerator: 'CmdOrCtrl+T', scope: 'app' } as const
