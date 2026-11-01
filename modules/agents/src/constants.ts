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
