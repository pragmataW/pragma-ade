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
