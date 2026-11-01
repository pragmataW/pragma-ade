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

/** Diff rendering. */
export const DIFF_CONTEXT_LINES = 3
export const DIFF_EXPANSION_LINES = 20
export const CHANGE_SCROLL_OFFSET_PX = 4
export const MERGE_BASE_SHORT_LEN = 7
/**
 * Injected into the diff's shadow root (`unsafe` layer): annotation rows (comment cards, the composer) keep their own
 * background inside a selected range instead of the line-selection tint.
 */
export const DIFF_UNSAFE_CSS =
  '[data-line-annotation][data-selected-line],[data-gutter-buffer=annotation][data-selected-line]{--diffs-line-bg:var(--diffs-annotation-bg)}'

/** Right tab. */
export const TAB_ID = 'git-changes'
export const TAB_ORDER = 40
export const TAB_ICON = 'git-compare'
/** 06's editor tab, activated after "Open in editor". */
export const FILES_TAB_ID = 'files'

/** Other modules' commands (optional dependencies, looked up with `commands.has`). */
export const EDITOR_OPEN_FILE_COMMAND = 'editor.openFile'
export const COMMENTS_OPEN_DRAWER_COMMAND = 'comments.openDrawer'

/** `@pierre/diffs` theme names per resolved mode. */
export const PIERRE_THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const
export const HUNK_SEPARATORS = 'line-info'

/** Prefix of every git call (paths stay unquoted, unicode intact). */
export const GIT_FLAGS = ['-c', 'core.quotepath=false'] as const
/** Test hook switch: register a fake `editor.openFile` recorder (PRAGMA_TEST only). */
export const FAKE_EDITOR_ENV = 'PRAGMA_TEST_FAKE_EDITOR'

/** Tree node ids: `d:<dir path>` / `f:<file path>`. */
export const DIR_ID_PREFIX = 'd:'
export const FILE_ID_PREFIX = 'f:'
/** Tree height until the container is measured (jsdom, first paint). */
export const TREE_FALLBACK_HEIGHT_PX = 600
export const TREE_ICON_PX = 14
export const TREE_RESIZE_STEP_PX = 16
export const DIFF_ICON_PX = 14
/** Repeated UI attribute values. */
export const ROLE_ALERT = 'alert'
export const VARIANT_OUTLINE = 'outline'
export const VARIANT_GHOST = 'ghost'
export const SIZE_SM = 'sm'
export const SIZE_ICON_SM = 'icon-sm'
