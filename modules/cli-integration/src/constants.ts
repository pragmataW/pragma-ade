/** Main/renderer-only constants (§9.2); literals shared with the CLI live in `contract/constants.ts`. */
import { SETTINGS_PAGE_ORDER as SDK_SETTINGS_PAGE_ORDER } from '@pragma/sdk'
import { CLI_MODULE_ID } from './contract/constants'

/** Install registry of skills we wrote (`<module data>/installed-skills.json`), never inside skill dirs. */
export const REGISTRY_FILE = 'installed-skills.json'
export const BIN_DIR_NAME = 'bin'
export const LAUNCH_DECORATOR_ID = `${CLI_MODULE_ID}.path`
export const LAUNCH_DECORATOR_ORDER = 500
export const SETTINGS_PAGE_ID = CLI_MODULE_ID
export const SETTINGS_PAGE_ORDER = SDK_SETTINGS_PAGE_ORDER.cli
export const HANDOFF_SLUG_MAX = 40
export const HANDOFF_BRANCH_PREFIX = 'handoff/'
export const HANDOFF_SLUG_FALLBACK = 'task'
export const POSIX_EXEC_MODE = 0o755
export const DEFAULT_POSIX_INSTALL_SUBDIR = ['.local', 'bin'] as const
/** Bundle and skills, relative to the module (dev) and to `resources/modules/cli-integration` (packaged). */
export const RESOURCE_PATHS = { bundle: 'packages/cli/dist/pragma.cjs', skills: 'skills' } as const
export const BOARD_MODULE_ID = 'board'
export const COMMENTS_MODULE_ID = 'comments'
export const WIN32 = 'win32'
export const PATH_KEY_RE = /^path$/i
export const PATH_KEYS = { posix: 'PATH', win32: 'Path' } as const
export const PATH_DELIMITERS = { posix: ':', win32: ';' } as const
/** PowerShell commands for the Windows user PATH; the new value travels in an env var (no quoting issues). */
export const POWERSHELL = {
  exe: 'powershell',
  args: ['-NoProfile', '-NonInteractive', '-Command'],
  getUserPath: "[Environment]::GetEnvironmentVariable('Path','User')",
  setUserPath: "[Environment]::SetEnvironmentVariable('Path', $env:PRAGMA_NEW_USER_PATH, 'User')",
  valueEnv: 'PRAGMA_NEW_USER_PATH',
} as const
/** lucide icon of Settings › Command line. */
export const SETTINGS_PAGE_ICON = 'square-terminal'

/** `pragma ask`: the provider capability and the headless runner (§9.2). */
export const ASK_CAPABILITY = 'ask'
/** SIGTERM first, SIGKILL after this. */
export const ASK_KILL_GRACE_MS = 5000
const KIB = 1024
const MIB = KIB * KIB
const ASK_MAX_STDOUT_MIB = 8
const ASK_MAX_STDERR_KIB = 64
/** Raw stdout above this kills the child (the answer is cut to `MAX_DOCUMENT_BYTES` later). */
export const ASK_MAX_STDOUT_BYTES = ASK_MAX_STDOUT_MIB * MIB
/** Only the last this-many bytes of stderr are kept (for error messages). */
export const ASK_MAX_STDERR_BYTES = ASK_MAX_STDERR_KIB * KIB
export const TASKKILL = { exe: 'taskkill', args: ['/T', '/F', '/PID'] } as const
export const ASK_MAX_CONCURRENT = 4
export const ASK_TEMP_PREFIX = 'ask-'
