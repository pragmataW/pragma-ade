/** `data-testid`s other phases' E2E tests may use (§10.1.6). */
export const TEST_IDS = {
  modeOption: (mode: string) => `settings-general-mode-${mode}`,
  paletteCard: (id: string) => `settings-general-palette-${id}`,
  densityOption: (density: string) => `settings-general-density-${density}`,
  languageSelect: 'settings-general-language',
  shortcutRow: (id: string) => `settings-general-shortcut-${id}`,
  moduleRow: (id: string) => `settings-general-module-${id}`,
  moduleToggle: (id: string) => `settings-general-module-toggle-${id}`,
  moduleState: (id: string) => `settings-general-module-state-${id}`,
  restart: 'settings-general-restart',
  quickTheme: 'settings-general-quick-theme',
} as const
