import type { Density, PaletteId, ThemeInput } from '@pragma/sdk'

export const MODULE_ID = 'settings-general'
export const DEFAULT_APPEARANCE = {
  mode: 'system',
  palette: 'vscode',
  density: 'compact',
} as const satisfies ThemeInput
export const DEFAULT_LANGUAGE = 'en'

export const PAGE_IDS = {
  general: 'general',
  appearance: 'appearance',
  shortcuts: 'shortcuts',
  modules: 'modules',
} as const
export const PAGE_ICONS = {
  general: 'settings-2',
  appearance: 'palette',
  shortcuts: 'keyboard',
  modules: 'blocks',
} as const

export const QUICK_TOGGLE_SLOT_ID = 'settings-general.quick-theme'
export const QUICK_TOGGLE_ORDER = 100
export const QUICK_TOGGLE_ICONS = { dark: 'moon', light: 'sun' } as const

/** Palette names are i18n keys under `appearance.palettes.<id>`; preview swatches use these tokens. */
export const PREVIEW_SWATCHES = ['ac', 'tx', 'mu'] as const
export const PALETTE_ORDER: readonly PaletteId[] = ['vscode', 'dark-brown', 'amber', 'indigo']
export const DENSITY_ORDER: readonly Density[] = ['compact', 'comfortable']

/** Display names of languages come from `Intl.DisplayNames` in the current UI language. */
export const LANGUAGE_DISPLAY_TYPE = 'language'
export const DARWIN = 'darwin'
export const ACCELERATOR_SEPARATOR = '+'
export const MAC_ACCELERATOR_TOKENS: Record<string, string> = {
  cmdorctrl: '⌘',
  commandorcontrol: '⌘',
  cmd: '⌘',
  command: '⌘',
  ctrl: '⌃',
  control: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
}
export const OTHER_ACCELERATOR_TOKENS: Record<string, string> = {
  cmdorctrl: 'Ctrl',
  commandorcontrol: 'Ctrl',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  alt: 'Alt',
  shift: 'Shift',
  super: 'Super',
}
export const OUTLINE_VARIANT = 'outline'
export const SINGLE_SELECT = 'single'
export const EMPTY_SHORTCUTS_ICON = 'keyboard'
