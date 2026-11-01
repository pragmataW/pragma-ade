/** Module-internal constants of `@pragma/module-terminal` (§9.2). */
export const TERMINAL_MODULE_ID = 'terminal'
/** Module-relative path of the daemon bundle; `extraResources.to` mirrors `from`, so dev and package agree. */
export const DAEMON_ENTRY_REL_PATH = 'packages/pty-daemon/dist/pty-daemon.cjs'

/** Default shell (Global Constraints): `$SHELL`, else the platform fallback, else `/bin/sh`. */
export const SHELL_ENV = 'SHELL'
export const SHELL_FALLBACKS: Partial<Record<NodeJS.Platform, string>> = { darwin: '/bin/zsh', linux: '/bin/bash' }
export const POSIX_SHELL = '/bin/sh'
export const LOGIN_SHELL_ARGS: Partial<Record<NodeJS.Platform, string[]>> = { darwin: ['-l'] }
export const PWSH_EXE = 'pwsh.exe'
export const POWERSHELL_EXE = 'powershell.exe'
export const WIN32 = 'win32'
