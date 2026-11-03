export const SLUG_MAX_LENGTH = 48

export const PLATFORM = { darwin: 'darwin', linux: 'linux', win32: 'win32' } as const

/** Module id of shell-provided services, IPC channels and commands. */
export const CORE_MODULE_ID = 'core'

export const CAPABILITY_KIND = 'capability'
export const SIDES = { main: 'main', renderer: 'renderer' } as const

export const SHORTCUT_SCOPE = { global: 'global', app: 'app' } as const

export const UTF8 = 'utf8'
export const TEMP_SUFFIX_BYTES = 6
export const JSON_INDENT = 2
export const BUSY_TIMEOUT_MS = 5000
export const DEFAULT_LANGUAGE = 'en'
export const SHELL_ENV_TIMEOUT_MS = 5000
export const RENDERER_COMMAND_TIMEOUT_MS = 10_000
export const APP_DIR_NAMES = {
  logs: 'logs',
  temp: 'pragma-ade',
  modules: 'modules',
  providers: 'providers',
  database: 'pragma.db',
  settings: 'settings.json',
  mainLog: 'main.log',
} as const

/**
 * Overlay occlusion (§10.2): how long a 'hide'-mode cover waits for a page capture before hiding without one. The view
 * stays up (over the overlay) while it waits: a page that has just loaded can take a few hundred ms to capture, and a
 * moment of overlay under the view beats a blanked view. Only a hung capture reaches this bound.
 */
export const SNAPSHOT_CAPTURE_TIMEOUT_MS = 1000
/** How long an occlusion snapshot stays under a re-shown native view, so the view has painted before it goes. */
export const SNAPSHOT_CLEAR_DELAY_MS = 200
/** How long a freshly published snapshot gets to paint before the native view above it is hidden (~2 frames). */
export const SNAPSHOT_PAINT_DELAY_MS = 34
