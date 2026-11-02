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
/** Order gap between provider settings pages after Settings › Chat. */
export const PROVIDER_PAGE_ORDER_STEP = 0.1
/** The renderer capability key of a provider's chat UI. */
export const CHAT_UI_CAPABILITY = 'chatUi'
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
export const SMALL_ICON_PX = 12
/** Tool-call input fields the kit renders (task prompt, todo list). */
export const TASK_PROMPT_FIELD = 'prompt'
export const TODO_INPUT_FIELD = 'todos'
/** Todo wording of tool inputs (`TodoWrite`-like) → kit todo status. */
export const TODO_STATUS_ALIASES: Record<string, 'pending' | 'active' | 'done'> = {
  pending: 'pending',
  in_progress: 'active',
  active: 'active',
  completed: 'done',
  done: 'done',
}
export const TODO_TEXT_FIELDS = ['content', 'text', 'title'] as const
/** Primitive input values longer than this are cut in the key/value body. */
export const KV_VALUE_CHARS = 160
export const ELLIPSIS = '…'
export const PLAN_MAX_H_PX = 420
/** Indent per nesting level in the task tree. */
export const TASK_INDENT_PX = 12
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
export const NEWLINE = '\n'
/** A whole message that is an i18n key (`<namespace>:<path>`), e.g. 11c's start-guard reasons. */
export const I18N_KEY_RE = /^[a-z][a-z0-9-]*:[A-Za-z0-9_.]+$/
export const ALIGN_END = 'end'
export const ALIGN_CENTER = 'center'
export const ALIGN_START = 'start'
export const SIZE_SM = 'sm'
export const VARIANT_OUTLINE = 'outline'
export const SECONDS_PAD = 2
export const NOTICE_MS = 4000
export const SLASH = '/'
export const AT = '@'
export const VARIANT_GHOST = 'ghost'
export const SIZE_ICON_XS = 'icon-xs'
export const COMPOSER_ROWS = 2

// 11c file references (`parseFileRef`)
export const BACKSLASH_RE = /\\/g
export const PARENT_SEGMENT = '..'
export const DOT_SLASH_RE = /^(?:\.\/)+/
export const DRIVE_PATH_RE = /^[A-Za-z]:\//
export const URL_SCHEME_RE = /^[A-Za-z][A-Za-z0-9+.-]*:\/\//
export const FILE_REF_ANCHOR_RE = /#L(?<line>\d+)$/
export const FILE_REF_LINE_COL_RE = /:(?<line>\d+)(?::(?<col>\d+))?$/
/** The last segment must have an extension (`README`, `Makefile` stay plain text). */
export const FILE_EXTENSION_RE = /^[^.].*\.[A-Za-z0-9]+$/
export const EDITOR_OPEN_FILE_COMMAND = 'editor.openFile'
export const GIT_CHANGES_REVEAL_COMMAND = 'gitChanges.reveal'
export const KEY_ENTER = 'Enter'
export const LINK_ROLE = 'link'
/** Tool-call inputs that name the file the call targets (header link). */
export const TOOL_TARGET_FIELDS = ['file_path', 'path'] as const
/** Marks an inline code span decorated as a file link (delegated clicks in `AssistantText`). */
export const FILE_REF_ATTR = 'data-chat-file-ref'
// 11c in-chat search
export const MARKDOWN_LINK_RE = /!?\[([^\]]*)\]\([^)]*\)/g
export const MARKDOWN_SYNTAX_RE = /[`*_~]|^#{1,6}\s+|^>\s?/gm
/** `data-chat-row={index}` on message-list rows (search highlights). */
export const CHAT_ROW_ATTR = 'data-chat-row'
export const SEARCH_HIGHLIGHT = 'chat-search'
export const SEARCH_HIGHLIGHT_CURRENT = 'chat-search-current'
export const SEARCH_SHORTCUT_KEY = 'f'
export const KEY_ESCAPE = 'Escape'
export const FENCE_OPEN_RE = /^ {0,3}(?<fence>`{3,}|~{3,})(?<info>[^`]*)$/
export const FENCE_CLOSE_RE = /^ {0,3}(?<fence>`{3,}|~{3,})\s*$/
export const CODE_SEGMENT = 'code'
