/** Module-internal constants (§9). Values other modules need live in `./contract`. */

export const COMMENTS_MODULE_ID = 'comments'

// Limits
export const COMMENT_BODY_MAX_CHARS = 20_000
export const FORMAT_LIMITS = {
  snippetMaxLines: 40,
  snippetMaxChars: 4000,
  outerHtmlMaxChars: 2000,
  textMaxChars: 200,
  consoleErrorsMax: 10,
  consoleErrorMaxChars: 300,
} as const
export type FormatLimits = { readonly [K in keyof typeof FORMAT_LIMITS]: number }

// Timings
/** Paste → Enter pause; TUIs (Claude Code, OpenCode) ignore an Enter that arrives while they still handle the paste. */
export const SUBMIT_DELAY_MS = 200
export const BRACKETED_WAIT_MS = 2_000
export const BRACKETED_POLL_MS = 100
export const READY_QUIET_MS = 500
export const READY_TIMEOUT_MS = 15_000
export const PTY_ID_POLL_MS = 100
export const PTY_ID_POLL_MAX_MS = 2_000
export const PENDING_TTL_MS = 600_000

// Renderer slot entries and orders
/** `host` mounts the drawer and dialogs (no visible UI); `toolbar` is the single entry button. */
export const SLOT_ENTRY_IDS = { host: 'comments.host', toolbar: 'comments.badge' } as const
export const SLOT_ORDER = 50

// Formatter (agent-facing, fixed English; §6)
export const ENTER = '\r'
export const NEWLINE = '\n'
export const MIN_FENCE = 3
export const INDENT = '   '
export const NESTED_INDENT = '     '
export const BACKTICK = '`'
export const BACKTICK_RUN = /`+/g
export const CRLF_RE = /\r\n?/g
export const BACKSLASH_RE = /\\/g
export const TRAILING_SPACE_RE = /[ \t]+$/gm
export const ELLIPSIS = '…'
/** Visible lines of a reply box before it grows. */
export const REPLY_ROWS = 2

/** A thread body longer than this (lines or characters) starts clamped behind "Show more". */
export const BODY_COLLAPSE_LINES = 12
export const BODY_COLLAPSE_CHARS = 800

/** Lucide icons of the drawer's empty states. */
export const EMPTY_ICONS = { noThreads: 'message-square-dashed', noWorktree: 'folder-git-2' } as const
/** `type` of plain (non-form) buttons. */
export const BUTTON_TYPE = 'button'
/** Relative time ("5m ago"): bucket sizes and how often a shown time re-renders. */
export const MINUTE_MS = 60_000
export const HOUR_MS = 3_600_000
export const DAY_MS = 86_400_000
export const TIME_TICK_MS = 30_000
/** Author marks next to a thread's names. */
export const AUTHOR_MARK_PX = 16
export const MONOGRAM_MAX_LETTERS = 2
/** Below this width (px) a thread's secondary actions (Edit, links, Delete) collapse into its "…" menu. */
export const THREAD_NARROW_PX = 360
