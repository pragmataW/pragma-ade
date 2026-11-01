/** Module-internal constants (§9); shared ones live in `contract/constants.ts`. */

export const GIT_LS_FILES_ARGS = ['ls-files', '--cached', '--others', '--exclude-standard'] as const
export const LINE_SPLIT_RE = /\r?\n/
/** `git ls-files` results are reused this long per worktree. */
export const FILE_LIST_CACHE_MS = 10_000
export const FILE_RANK = { basenamePrefix: 0, pathPrefix: 1, subsequence: 2 } as const
export const PATH_SEPARATOR = '/'

/** Renderer registrations. */
export const CHAT_SLOT_ENTRY_ID = 'chat'
export const CHAT_VIEW_ORDER = 20
export const CHAT_MODE_OPTION_ID = 'chat.mode'
export const CHAT_STATUSBAR_ID = 'chat.context'
export const CHAT_STATUSBAR_ORDER = 60
export const CHAT_SETTINGS_ICON = 'message-square'
export const PERCENT = 100
/** Kit metrics (ui-notes). */
export const CONTEXT_WARN_RATIO = 0.8
export const RING = { box: 14, c: 7, r: 5.5, stroke: 1.5 } as const
export const LIST_OVERSCAN = 8
export const STICK_BOTTOM_PX = 48
export const SHELL_OUTPUT_MAX_H_PX = 320
export const READ_PREVIEW_LINES = 20
export const QUEUE_CHIP_CHARS = 60
export const MENTION_DEBOUNCE_MS = 120
export const ROW_ESTIMATE_PX = 64
/** Until the scroller is measured (first paint, tests). */
export const INITIAL_RECT = { width: 740, height: 800 } as const
export const ICON_PX = 14
export const MARK_PX = 14
export const ELAPSED_TICK_MS = 1000
export const MS_PER_SECOND = 1000
export const SECONDS_PER_MINUTE = 60
export const JSON_INDENT = 2
export const NO_FILL = 'none'
export const TWO_PI = 2 * Math.PI
/** `@pierre/diffs` custom properties (they inherit into its shadow root). */
export const DIFF_STYLE_VARS = {
  '--diffs-font-family': 'var(--font-code)',
  '--diffs-font-size': '12px',
  '--diffs-line-height': '20px',
  '--diffs-addition-color-override': 'var(--add-tx)',
  '--diffs-deletion-color-override': 'var(--del-tx)',
} as const
export const PIERRE_THEMES = { dark: 'pierre-dark', light: 'pierre-light' } as const
export const DIFF_UNIFIED = 'unified'
export const ICON_STROKE = 1.5
export const BUTTON_TYPE = 'button'
export const ALIGN_END = 'end'
export const SIZE_SM = 'sm'
export const VARIANT_OUTLINE = 'outline'
export const SECONDS_PAD = 2
