/** Module-internal constants (§9). Values other modules need live in `./contract`. */

export const COMMENTS_MODULE_ID = 'comments'

// Limits
export const COMMENT_BODY_MAX_CHARS = 20_000
export const SENT_LIST_LIMIT = 100
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
export const SUBMIT_DELAY_MS = 30
export const BRACKETED_WAIT_MS = 2_000
export const BRACKETED_POLL_MS = 100
export const READY_QUIET_MS = 500
export const READY_TIMEOUT_MS = 15_000
export const PTY_ID_POLL_MS = 100
export const PTY_ID_POLL_MAX_MS = 2_000
export const PENDING_TTL_MS = 600_000

// Session states that can no longer receive comments
export const ENDED_SESSION_STATUSES: readonly string[] = ['exited', 'error'] as const

// Renderer slot entries and orders
export const SLOT_ENTRY_IDS = { titlebar: 'comments.entry', toolbar: 'comments.badge' } as const
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
