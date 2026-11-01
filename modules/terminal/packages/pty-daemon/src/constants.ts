/** Daemon-internal constants (§9.2); values main needs too live in `protocol.ts`. */
export const PASTE_START = '\x1b[200~'
export const PASTE_END = '\x1b[201~'
/** Line ends a pasted text may contain; a terminal sends CR for Enter. */
export const PASTE_NEWLINE_RE = /\r\n|\n/g
export const CARRIAGE_RETURN = '\r'

export const HELPER_MODE = 0o755
export const SPAWN_HELPER = 'spawn-helper'
export const NODE_PTY_PACKAGE_JSON = 'node-pty/package.json'
export const PREBUILDS_DIR = 'prebuilds'
export const BUILD_RELEASE_DIR = ['build', 'Release'] as const
export const WIN32 = 'win32'
export const IGNORED_FS_ERRORS: readonly string[] = ['ENOENT', 'EACCES', 'EPERM']

/** Output coalescing: flush after this delay or once this many bytes are pending, whichever comes first. */
export const COALESCE_MS = 4
export const COALESCE_MAX_BYTES = 65_536
/** A `kill()` that does not end the process escalates to SIGKILL after this delay. */
export const KILL_ESCALATION_MS = 3000
export const ESCALATION_SIGNAL = 'SIGKILL'
export const UNICODE_VERSION = '11'

/** Shutdown: hang up every pty, SIGKILL whatever is left after this grace period. */
export const SHUTDOWN_GRACE_MS = 2000
/** Response id used when a malformed request has no usable id. */
export const UNKNOWN_REQUEST_ID = -1
export const EXIT_OK = 0
