/** Module-internal literals (§9.2); anything other modules need lives in `contract/constants.ts`. */
import { LABEL_COLORS } from './contract/constants'
import type { LabelColor } from './contract/dto'

/** Branch slug cap (ui-notes: `feat/<key>-<slug>`). */
export const SLUG_MAX_CHARS = 40
export const KEY_PREFIX_LENGTH = 3
export const FALLBACK_KEY_PREFIX = 'TSK'
export const BRANCH_PREFIX = 'feat/'
export const SLUG_SEPARATOR = '-'
export const PROMPT_SEPARATOR = '\n\n'
export const NON_SLUG_CHARS_RE = /[^a-z0-9]+/g
/** First suffix for a taken name: `PRA` → `PRA2`, `feat/x` → `feat/x-2`. */
export const FIRST_DUPLICATE_SUFFIX = 2
/** `PRA-12` (prefix letters/digits, task number). */
export const TASK_KEY_RE = /^(?<prefix>[A-Za-z0-9]+)-(?<number>\d+)$/
export const DIGITS_RE = /^\d+$/
/** `prepareStart` tries `<branch>-2` … `<branch>-50` before giving up on a free suggestion. */
export const MAX_BRANCH_SUFFIX = 50
export const REMOTE_HEAD_RE = /\/HEAD$/
/** Coalesces bursts of `board.changed` into one renderer push. */
export const CHANGE_PUSH_DEBOUNCE_MS = 50
/** `agentSession.updated` fields that change a linked session's DTO beyond start/exit (`closedAt` → ended). */
export const SESSION_REFRESH_FIELDS: ReadonlySet<string> = new Set(['closedAt', 'title'])
/** Whether the drawer can go to a linked session: open, ended (03's record), or its worktree is gone (01). */
export const SESSION_AVAILABILITIES = ['open', 'ended', 'worktreeRemoved'] as const
export const WORKTREE_FILTERS = ['any', 'with', 'without'] as const
/** Agent filter value for "tasks without a linked session". */
export const NO_AGENT_FILTER_VALUE = 'none'
export const VIEW_MODES = ['board', 'list'] as const
export const LAST_SCOPE_STORAGE_KEY = 'pragma.board.lastScope'
export const SIDEBAR_ENTRY_ID = 'board.sidebar'
export const SIDEBAR_ENTRY_ORDER = 100
export const VIEW_ICON = 'kanban'
/** Lucide icons of the board's empty states. */
export const EMPTY_ICONS = {
  noProjects: 'folder-plus',
  noTasks: 'square-kanban',
  noMatches: 'search-x',
  add: 'plus',
} as const
export const SETTINGS_ICON = 'kanban'
/** The header's Back control, the Settings view's icon. */
export const BACK_ICON = 'arrow-left'
export const KEYDOWN_EVENT = 'keydown'
export const ICON_PX = { row: 14, small: 12 } as const
export const VARIANT = {
  ghost: 'ghost',
  outline: 'outline',
  destructive: 'destructive',
  secondary: 'secondary',
} as const
export const SIZE = { sm: 'sm', xs: 'xs', iconSm: 'icon-sm', iconXs: 'icon-xs' } as const
export const ALL_SCOPE_VALUE = 'all'
export const PROJECT_SCOPE_PREFIX = 'project:'
/** Filled bars of the 3-bar priority mark. */
export const PRIORITY_BARS = { none: 0, low: 1, medium: 2, high: 3, urgent: 3 } as const
/** Heights of the three bars, shortest first. */
export const PRIORITY_BAR_CLASSES = ['h-1', 'h-[7px]', 'h-2.5'] as const
export const DESCRIPTION_ROWS = 8
export const COLUMN_DESCRIPTION_ROWS = 4
export const MONOGRAM_LETTERS = 2
/** ui-notes mark sizes: 20px on cards. */
export const AGENT_MARK_PX = 20
export const ESCAPE_KEY = 'Escape'
export const ENTER_KEY = 'Enter'
/** Pointer travel before a drag starts (clicks stay clicks). */
export const DRAG_ACTIVATION_PX = 5
export const DND_TASK_PREFIX = 'task:'
export const DND_COLUMN_PREFIX = 'column:'
export const DND_KIND = { task: 'task', column: 'column' } as const
export const SEARCH_DEBOUNCE_MS = 150
export const MENU_ALIGN = { start: 'start', end: 'end' } as const
export const BRANCH_CHECK_DEBOUNCE_MS = 250
/** Radix Select needs a non-empty value for "no worktree". */
export const NONE_WORKTREE_VALUE = '__none__'
export const ROLE_ALERT = 'alert'
/** Colours given to new labels in turn: gray reads as "no colour" (ui-notes: label chips have a coloured dot). */
export const AUTO_LABEL_COLORS: readonly LabelColor[] = LABEL_COLORS.filter((c) => c !== 'gray')
/** A GFM task list item: bullet or number, then `[ ]` / `[x]` and some text (fenced code is not excluded). */
export const CHECKLIST_ITEM_RE = /^[ \t]*(?:[-*+]|\d+[.)])[ \t]+\[(?<mark>[ xX])\][ \t]+\S/gm
