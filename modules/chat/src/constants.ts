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
export const LARGE_ICON_PX = 16
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
/** Tasks panel (docked right in the chat view; overlays the transcript when the chat would get narrower). */
export const TASKS_PANEL = { defaultWidth: 380, minWidth: 300, maxWidth: 640, keyStep: 24 } as const
/** Below this transcript width the panel overlays it instead of docking. */
export const TASKS_PANEL_MIN_CHAT_PX = 480
/** "Show in chat" highlight and the indicator's new-task pulse. */
export const TASK_FLASH_MS = 1600
/** Longer prompts are clamped in the task detail ("Show more"). */
export const TASK_PROMPT_CLAMP_CHARS = 280
export const TASK_PULSE_MS = 1200
export const TASKS_COMMAND_ID = 'chat.toggleTasksPanel'
export const TASKS_SHORTCUT = { accelerator: 'CmdOrCtrl+Shift+A', scope: 'app' } as const
export const MAC_USER_AGENT_RE = /Mac/
/** Joins meta parts ("12.3K tokens · $0.02"). */
export const META_SEPARATOR = ' · '
export const ROLE_RADIO = 'radio'
export const KEY_ARROW_LEFT = 'ArrowLeft'
export const KEY_ARROW_RIGHT = 'ArrowRight'
export const POINTER_MOVE = 'pointermove'
export const POINTER_UP = 'pointerup'
export const SCROLL_CENTER = 'center'
export const SCROLL_SMOOTH = 'smooth'
/** Numbers and times in the kit use the app's locale (English in v1), not the system one. */
export const FORMAT_LOCALE = 'en-US'
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

// Rich Markdown: tables, Mermaid diagrams, ASCII diagrams, code frames
export const MERMAID_LANG = 'mermaid'
/** How a fence renders (`data-variant` of its frame). */
export const CODE_KIND = { code: 'code', ascii: 'ascii', mermaid: MERMAID_LANG } as const
export const MERMAID_STATUS = { pending: 'pending', ready: 'ready', failed: 'failed' } as const
export const MERMAID_VIEW = { diagram: 'diagram', source: 'source' } as const
export const SIZE_ICON = 'icon'
export const CHECK_STROKE = 3
export const MD_CELL_SEPARATOR = ' | '
/** Fences without a language (or plain-text ones) keep their exact monospace layout (ASCII/box diagrams). */
export const ASCII_LANGS = ['', 'text', 'txt', 'plain', 'plaintext', 'ascii', 'diagram'] as const
/** Box-drawing and block elements: such a plain fence is labelled as a diagram. */
export const BOX_DRAWING_RE = /[─-▟]/
/** A table cell that reads as a number (`1,024`, `-3.5`, `12%`, `$40`, `250ms`, `1.2k`). */
export const NUMERIC_CELL_RE = /^[-+−]?[$€£¥]?\d[\d,_.]*\s?(?:%|[kKmMbB]|ms|s|x|×)?$/
/** A GFM table row (pipe-led). */
export const TABLE_ROW_RE = /^\s{0,3}\|/
/** A GFM table delimiter row (`| --- | :---: |`). */
export const TABLE_DELIMITER_RE = /^\s{0,3}\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/
export const CSV_SEPARATOR = ','
export const CSV_NEEDS_QUOTES_RE = /[",\r\n]/
export const CSV_QUOTE_RE = /"/g
export const MD_PIPE_RE = /\|/g
export const CELL_BREAK_RE = /\s*\n\s*/g
/** A table taller than this scrolls with a sticky header. */
export const TABLE_MAX_HEIGHT_PX = 420
/** Scroll slack before an edge counts as reached (sub-pixel widths). */
export const SCROLL_EDGE_SLACK_PX = 2
export const MERMAID_ID_PREFIX = 'chat-mermaid-'
export const MERMAID_ZOOM = { min: 0.5, max: 3, step: 0.25 } as const
export const MERMAID_FONT_SIZE = '13px'
/** Sequence diagrams default to 16px text in 150×65 boxes; match the chat's compact type scale instead. */
export const MERMAID_SEQUENCE = {
  actorFontSize: 13,
  messageFontSize: 12.5,
  noteFontSize: 12,
  width: 120,
  height: 36,
  actorMargin: 40,
  boxMargin: 8,
  messageMargin: 30,
  mirrorActors: false,
} as const
export const MERMAID_THEME = 'base'
export const MERMAID_SECURITY = 'strict'
export const FONT_UI_VAR = '--font-ui'
/** Mermaid `base` theme variable → app colour token (hex values, read at render time). */
export const MERMAID_THEME_TOKENS = {
  background: '--bg',
  mainBkg: '--el',
  primaryColor: '--el',
  primaryTextColor: '--tx',
  primaryBorderColor: '--bd2',
  secondaryColor: '--acs',
  secondaryTextColor: '--tx',
  secondaryBorderColor: '--ac',
  tertiaryColor: '--pn',
  tertiaryTextColor: '--tx',
  tertiaryBorderColor: '--bd',
  nodeBorder: '--bd2',
  nodeTextColor: '--tx',
  textColor: '--tx',
  titleColor: '--tx',
  lineColor: '--mu',
  edgeLabelBackground: '--pn',
  clusterBkg: '--pn',
  clusterBorder: '--bd2',
  actorBkg: '--el',
  actorBorder: '--bd2',
  actorTextColor: '--tx',
  actorLineColor: '--bd2',
  signalColor: '--mu',
  signalTextColor: '--tx',
  labelBoxBkgColor: '--el',
  labelBoxBorderColor: '--bd2',
  labelTextColor: '--tx',
  loopTextColor: '--mu',
  noteBkgColor: '--acs',
  noteTextColor: '--tx',
  noteBorderColor: '--ac',
  activationBkgColor: '--acs',
  activationBorderColor: '--ac',
  sequenceNumberColor: '--acfg',
  errorBkgColor: '--el',
  errorTextColor: '--err',
} as const
