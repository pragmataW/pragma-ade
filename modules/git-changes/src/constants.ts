/** Every module-internal literal and number of git-changes (§9). Shared values live in `src/contract/`. */
export const MODULE_ID = 'git-changes'

/** Files above this size (bytes) are not diffed (setting `maxFileBytes`). */
export const MAX_FILE_BYTES_DEFAULT = 1_048_576
/** A NUL within the first N bytes marks a file as binary (git's own heuristic). */
export const BINARY_SNIFF_BYTES = 8000
/** `git hash-object -t tree /dev/null`: the old side of a repository without commits. */
export const EMPTY_TREE_SHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

/** Tree metrics (ui-notes). */
export const TREE_ROW_HEIGHT_PX = 22
export const TREE_INDENT_PX = 12
export const TREE_WIDTH_PX = 232
export const TREE_MIN_WIDTH_PX = 140
export const TREE_MAX_WIDTH_PX = 480
/** The file list collapses fully (toolbar toggle, command, separator double-click). */
export const TREE_COLLAPSED_PX = 0
export const DIFF_MIN_WIDTH_PX = 240
/** `host.layout` keys: the split's sizes (`useDefaultLayout`) and whether the file list is collapsed. */
export const SPLIT_LAYOUT_ID = 'git-changes.split'
export const TREE_COLLAPSED_LAYOUT_KEY = 'git-changes.treeCollapsed'

/** Diff rendering. */
export const DIFF_CONTEXT_LINES = 3
export const DIFF_EXPANSION_LINES = 20
export const CHANGE_SCROLL_OFFSET_PX = 4
export const MERGE_BASE_SHORT_LEN = 7
/**
 * Injected into the diff's shadow root (`unsafe` layer): annotation rows (comment cards, the composer) keep their own
 * background inside a selected range instead of the line-selection tint.
 */
/** Find in diff (Cmd/Ctrl+F): CSS Custom Highlight names, styled inside the diff's shadow root below. */
export const FIND_HIGHLIGHT = { all: 'gc-find', current: 'gc-find-current' } as const
/** Context kept above a match scrolled into view. */
export const FIND_SCROLL_MARGIN_PX = 48
/** Rows still changing (a re-render in progress) wait this long before matches are found again. */
export const FIND_REFIND_DELAY_MS = 30
export const DIFF_UNSAFE_CSS =
  '[data-line-annotation][data-selected-line],[data-gutter-buffer=annotation][data-selected-line]{--diffs-line-bg:var(--diffs-annotation-bg)}' +
  '::highlight(gc-find){background-color:color-mix(in srgb,var(--warn) 35%,transparent)}' +
  '::highlight(gc-find-current){background-color:color-mix(in srgb,var(--warn) 80%,transparent);color:var(--bg)}'

/** Right tab. */
export const TAB_ID = 'git-changes'
export const TAB_ORDER = 40
export const TAB_ICON = 'git-compare'
/** 06's editor tab, activated after "Open in editor". */
export const FILES_TAB_ID = 'files'

/**
 * Other modules' commands (optional dependencies, looked up with `commands.has`). "Open in editor" opens the file's git
 * diff in 06's workbench (user decision 2026-11-02, revised): `editor.openDiff`, not `editor.openFile`.
 */
export const EDITOR_OPEN_DIFF_COMMAND = 'editor.openDiff'
/** `refs.new` of a branch-mode diff (merge-base ↔ HEAD). */
export const HEAD_REF = 'HEAD'
export const COMMENTS_OPEN_DRAWER_COMMAND = 'comments.openDrawer'

/** `@pierre/diffs` theme names per resolved mode. */
export const PIERRE_THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const
export const HUNK_SEPARATORS = 'line-info'

/** The commit message box grows with its text up to this many rows. */
export const COMMIT_BOX_MAX_ROWS = 6
/** fetch / pull / push may wait on the network much longer than local git calls. */
export const NETWORK_TIMEOUT_MS = 120_000

/** Prefix of every git call (paths stay unquoted, unicode intact). */
export const GIT_FLAGS = ['-c', 'core.quotepath=false'] as const
/** Test hook switch: register a fake `editor.openDiff` recorder (PRAGMA_TEST only). */
export const FAKE_EDITOR_ENV = 'PRAGMA_TEST_FAKE_EDITOR'

/** Tree node ids: `d:<dir path>` / `f:<file path>`. */
export const DIR_ID_PREFIX = 'd:'
export const FILE_ID_PREFIX = 'f:'
/** Group node ids (`g:staged` / `g:unstaged`). */
export const GROUP_ID_PREFIX = 'g:'
/** Entry key prefix of a staged entry: a repo path is never absolute, so it never collides with an unstaged key. */
export const STAGED_KEY_PREFIX = '/staged/'
/** Tree height until the container is measured (jsdom, first paint). */
export const TREE_FALLBACK_HEIGHT_PX = 600
export const TREE_ICON_PX = 14
export const ROW_ACTION_ICON_PX = 13
export const DIFF_ICON_PX = 14
export const FILTER_ICON_PX = 12
/** Lucide icons of the panel's empty, loading and failed states. */
export const EMPTY_ICONS = {
  noWorktree: 'folder-git-2',
  loading: 'loader-circle',
  failed: 'triangle-alert',
  noChanges: 'git-compare',
  noMatches: 'search-x',
} as const
/**
 * File filter (fuzzy path match): points per matched character, bonuses for a match at a word start (`/ - _ .`,
 * camelCase), inside the basename, at the basename's start and right after the previous match; a gap costs `gap`.
 */
export const FILTER_SCORE = {
  match: 16,
  boundary: 10,
  basename: 6,
  basenameStart: 12,
  consecutive: 12,
  gap: 4,
} as const
/** Prepared (segmented, folded) paths kept in memory before the cache starts over. */
export const FILTER_CACHE_MAX = 20_000
/** Repeated UI attribute values. */
export const BUTTON_TYPE = 'button'
export const ROLE_ALERT = 'alert'
export const VARIANT_OUTLINE = 'outline'
export const VARIANT_GHOST = 'ghost'
export const SIZE_SM = 'sm'
export const SIZE_ICON_SM = 'icon-sm'
