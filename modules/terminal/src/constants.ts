/** Module-internal constants of `@pragma/module-terminal` (§9.2). */
export const TERMINAL_MODULE_ID = 'terminal'
/** Module-relative path of the daemon bundle; `extraResources.to` mirrors `from`, so dev and package agree. */
export const DAEMON_ENTRY_REL_PATH = 'packages/pty-daemon/dist/pty-daemon.cjs'

/** Default shell (Global Constraints): `$SHELL`, else the platform fallback, else `/bin/sh`. */
export const SHELL_ENV = 'SHELL'
export const SHELL_FALLBACKS: Partial<Record<string, string>> = { darwin: '/bin/zsh', linux: '/bin/bash' }
export const POSIX_SHELL = '/bin/sh'
export const LOGIN_SHELL_ARGS: Partial<Record<string, string[]>> = { darwin: ['-l'] }
export const PWSH_EXE = 'pwsh.exe'
export const POWERSHELL_EXE = 'powershell.exe'
export const WIN32 = 'win32'

/** Daemon crash restarts: delay per consecutive restart, capped per window. */
const RESTART_DELAY_FIRST_MS = 250
const RESTART_DELAY_SECOND_MS = 1000
const RESTART_DELAY_LATER_MS = 3000
export const RESTART_DELAYS_MS = [RESTART_DELAY_FIRST_MS, RESTART_DELAY_SECOND_MS, RESTART_DELAY_LATER_MS] as const
export const MAX_RESTARTS_PER_MINUTE = 5
export const RESTART_WINDOW_MS = 60_000
export const HOST_SHUTDOWN_TIMEOUT_MS = 3000
export const RUN_AS_NODE_ENV = 'ELECTRON_RUN_AS_NODE'
export const RUN_AS_NODE_ON = '1'
export const DAEMON_STDIO: ['ignore', 'pipe', 'pipe', 'ipc'] = ['ignore', 'pipe', 'pipe', 'ipc']
export const KILL_NOW_SIGNAL = 'SIGKILL'
export const EXIT_EVENT = 'exit'
export const DAEMON_UNAVAILABLE = 'pty-daemon is not available'

/** Spawn env overrides (after the login-shell env and `opts.env`). */
export const COLORTERM_VALUE = 'truecolor'
export const TERM_PROGRAM_NAME = 'PragmaADE'
export const PATH_SEPARATOR_RE = /[\\/]/

/** Size of a pty before its view measured itself. */
export const DEFAULT_COLS = 80
export const DEFAULT_ROWS = 24

/** `terminal.openLink` accepts only web links (other schemes are rejected). */
export const ALLOWED_LINK_PROTOCOLS = ['http:', 'https:'] as const
export const UNSUPPORTED_LINK_MESSAGE = 'terminal: unsupported link scheme'
