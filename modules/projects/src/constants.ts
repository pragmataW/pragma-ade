/** Module-internal named constants (§9). Anything other modules need lives in `src/contract/`. */
export const MODULE_ID = 'projects'

/** Absolute POSIX/Windows path, or one starting with `~`. */
export const ABSOLUTE_OR_HOME_PATH_RE = /^(~|\/|[A-Za-z]:[\\/]|\\\\)/
export const DEFAULT_WORKTREES_ROOT = '~/pragma/worktrees'

/** `git status --porcelain=v2`: space-separated fields before the path, per record tag. */
export const STATUS_RECORD_FIELDS = { '1': 8, '2': 9, u: 10, '?': 1 } as const
export const STATUS_HEADER_PREFIX = '# '
export const STATUS_HEADERS = {
  oid: 'branch.oid',
  head: 'branch.head',
  upstream: 'branch.upstream',
  ab: 'branch.ab',
} as const
export const STATUS_INITIAL_OID = '(initial)'
export const STATUS_DETACHED_HEAD = '(detached)'
export const STATUS_AB_RE = /^\+(?<ahead>\d+) -(?<behind>\d+)$/
export const UNTRACKED_XY = '?'

/** `git worktree list --porcelain` attribute names. */
export const WORKTREE_ATTRS = {
  worktree: 'worktree',
  head: 'HEAD',
  branch: 'branch',
  bare: 'bare',
  detached: 'detached',
  locked: 'locked',
  prunable: 'prunable',
} as const

export const REF_PREFIXES = { heads: 'refs/heads/', remotes: 'refs/remotes/' } as const
export const REMOTE_HEAD_SUFFIX = '/HEAD'
export const NUL = '\0'
export const NEWLINE = '\n'
export const SPACE = ' '

export const GIT_BINARY = 'git'
export const GIT_MAX_BUFFER_BYTES = 67_108_864 // 64 MiB
export const GIT_ENV = {
  terminalPrompt: 'GIT_TERMINAL_PROMPT',
  optionalLocks: 'GIT_OPTIONAL_LOCKS',
  lcAll: 'LC_ALL',
} as const
export const GIT_ENV_OFF = '0'
export const GIT_LOCALE = 'C'
/** Prefixed to every git invocation: paths are printed verbatim (no octal quoting). */
export const GIT_GLOBAL_ARGS = ['-c', 'core.quotepath=false'] as const
export const ENOENT = 'ENOENT'
export const GIT_TRUE = 'true'
export const DOT_GIT = '.git'
export const ORIGIN_PREFIX = 'origin/'
export const FALLBACK_BASE_BRANCHES = ['main', 'master'] as const
export const HEAD = 'HEAD'
export const COMMIT_PEEL = '^{commit}'
export const MERGE_BASE_NONE_EXIT = 1
export const BRANCH_CHECKED_OUT_RE = /already checked out|is already used by worktree/
export const PATH_EXISTS_RE = /^fatal: '.+' already exists/m

const ABSOLUTE_PATHS = '--path-format=absolute'
/** git argument vectors (one place for every command spelling). */
export const GIT_ARGS = {
  status: ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all'],
  isBare: ['rev-parse', '--is-bare-repository'],
  absoluteGitDir: ['rev-parse', '--absolute-git-dir'],
  commonDir: ['rev-parse', ABSOLUTE_PATHS, '--git-common-dir'],
  topLevel: ['rev-parse', '--show-toplevel'],
  gitDirs: ['rev-parse', ABSOLUTE_PATHS, '--git-dir', '--git-common-dir'],
  verifyCommit: ['rev-parse', '--verify', '--quiet'],
  originHead: ['symbolic-ref', '--quiet', 'refs/remotes/origin/HEAD'],
  currentBranch: ['symbolic-ref', '--short', 'HEAD'],
  mergeBase: ['merge-base'],
  show: ['show'],
  worktreeList: ['worktree', 'list', '--porcelain', '-z'],
  worktreeAdd: ['worktree', 'add'],
  worktreeRemove: ['worktree', 'remove'],
  worktreePrune: ['worktree', 'prune'],
  branchList: ['for-each-ref', '--format=%(refname)%00%(worktreepath)%00', 'refs/heads', 'refs/remotes'],
  branchDelete: ['branch'],
  checkBranchName: ['check-ref-format', '--branch'],
  countCommits: ['rev-list', '--count'],
} as const
export const GIT_FLAGS = { newBranch: '-b', force: '--force', deleteMerged: '-d', deleteForce: '-D' } as const
export const UTF8 = 'utf8'

/** Branch and project folder names (SDK `slugify`, longer than its 48-char default for branch names). */
export const BRANCH_SLUG_MAX_LENGTH = 80
export const BRANCH_SLUG_FALLBACK = 'worktree'
export const PROJECT_SLUG_FALLBACK = 'project'
export const HOME_PREFIX_RE = /^~(?=$|[\\/])[\\/]?/
export const DEDUPE_FIRST_SUFFIX = 2
export const DEDUPE_SEPARATOR = '-'

/** SQLite tables (`migrations/0101_projects.sql`) and shared column names. */
export const TABLES = {
  projects: 'projects_projects',
  worktrees: 'projects_worktrees',
  state: 'projects_state',
} as const
export const COLUMNS = {
  id: 'id',
  name: 'name',
  repoPath: 'repo_path',
  defaultBaseBranch: 'default_base_branch',
  createdAt: 'created_at',
  sortOrder: 'sort_order',
  archivedAt: 'archived_at',
  projectId: 'project_id',
  path: 'path',
  branch: 'branch',
  baseBranch: 'base_branch',
  isMain: 'is_main',
  key: 'key',
  value: 'value',
} as const
export const ACTIVE_WORKTREE_STATE_KEY = 'activeWorktreeId'

/** File watching (`@parcel/watcher`). */
export const WATCH_DEBOUNCE_MS = 300
export const CHANGED_PATHS_CAP = 500
/** The main checkout's `.git` dir is covered by the git-dir watcher. */
export const WORKTREE_IGNORE = ['.git', '.git/**', 'node_modules', '**/node_modules/**']
export const GIT_DIR_IGNORE = ['objects/**', 'logs/**', 'lfs/**', 'hooks/**', '**/*.lock']
export const POSIX_SEP = '/'
export const WINDOWS_SEP_RE = /\\/g
/** Git-dir files whose change means "the main checkout's HEAD/index moved". */
export const ROOT_HEAD_FILES = ['HEAD', 'index', 'ORIG_HEAD', 'MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD']
export const GIT_DIR_PATHS = {
  worktrees: 'worktrees/',
  packedRefs: 'packed-refs',
  config: 'config',
  stash: 'refs/stash',
} as const
export const PARENT_PREFIX = '..'

/** Watcher keys (one subscription per worktree and per repository git dir). */
export const WATCH_KEY_PREFIX = { worktree: 'wt:', repo: 'repo:' } as const
export const PICKER_TITLE_KEY = 'projects:addProject.pickerTitle'

/** Renderer registrations (slot entry ids and orders). */
export const SLOT_ENTRY_IDS = {
  sidebar: 'projects',
  breadcrumb: 'projects.breadcrumb',
  branch: 'projects.branch',
  changedFiles: 'projects.changedFiles',
} as const
export const SIDEBAR_ORDER = 10
export const BREADCRUMB_ORDER = 10
/** First status bar item (06 LSP, 08 dev URL, 11a context % come after it). */
export const STATUSBAR_ORDER_BRANCH = 10
export const BADGE_ORDER_CHANGED_FILES = 10
export const ICON_PX = { small: 12, row: 14 } as const
export const FOCUS_EVENT = 'focus'
export const ERROR_KEY_PREFIX = 'projects:errors.'
export const DRAG_ACTIVATION_PX = 5
export const ICONS = {
  add: 'plus',
  collapsed: 'chevron-right',
  expanded: 'chevron-down',
  menu: 'ellipsis',
  branch: 'git-branch',
  dismiss: 'x',
  settings: 'folder-git-2',
  filter: 'list-filter',
} as const
/** Closes and clears the sidebar filter. */
export const FILTER_CLEAR_KEY = 'Escape'
export const STATUS_PART_SEPARATOR = ' '
export const GHOST_VARIANT = 'ghost'
/** Projects settings page: between Shortcuts (40) and Agents (50) (§10.4). */
export const SETTINGS_PAGE_ORDER = 45
export const SETTINGS_PAGE_ID = 'projects'
export const PATH_SUGGEST_DEBOUNCE_MS = 200
export const BUTTON_VARIANTS = { outline: 'outline', destructive: 'destructive' } as const
export const FIELD_IDS = {
  branch: 'projects-create-branch-input',
  branchList: 'projects-create-branch-list',
  base: 'projects-create-base-select',
  path: 'projects-create-path-input',
  deleteBranch: 'projects-remove-delete-branch-input',
  root: 'projects-settings-root-input',
} as const
export const BUTTON_TYPES = { button: 'button', submit: 'submit' } as const
export const ALERT_ROLE = 'alert'
