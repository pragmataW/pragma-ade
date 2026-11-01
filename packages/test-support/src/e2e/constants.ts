export const LAUNCH_TIMEOUT_MS = 30_000
export const SETTINGS_WAIT_MS = 5_000
export const SETTINGS_POLL_MS = 50
/** More than dnd-kit's default 5px distance activation constraint. */
export const DND_ACTIVATION_PX = 10
export const DND_STEPS = 12
export const E2E_TEMP_PREFIX = 'pragma-e2e-'
export const DESKTOP_DIR = 'apps/desktop'
export const MAIN_ENTRY = 'main/index.js'
export const BUILD_VARIANTS = { default: 'default', extensionProof: 'extension-proof' } as const
export type BuildVariant = (typeof BUILD_VARIANTS)[keyof typeof BUILD_VARIANTS]
export const BUILD_OUT_DIRS: Record<BuildVariant, string> = {
  default: 'out',
  'extension-proof': 'out-extension-proof',
}
export const ELECTRON_PACKAGE = 'electron'
export const CONSOLE_EVENT = 'console'
export const DARWIN = 'darwin'
export const PALETTE_KEYS = { darwin: 'Meta+K', other: 'Control+K' } as const
export const HALF = 2
export const THEME_ATTRIBUTE = 'data-theme'
/** Phase reports keep E2E screenshots here (docs/phases/README.md, visual check). */
export const SCREENS_DIR = (phase: string): string => `docs/phases/reports/${phase}/screens`
export const PNG = '.png'
