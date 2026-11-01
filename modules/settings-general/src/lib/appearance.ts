import type { ThemeInput, ThemeMode, ThemeState } from '@pragma/sdk'
import type { GeneralSettings } from '../contract/schemas'

const DARK: ThemeMode = 'dark'
const LIGHT: ThemeMode = 'light'

/** The theme controller input stored in the `settings-general` section. */
export const toThemeInput = (s: GeneralSettings): ThemeInput => ({
  mode: s.appearance.mode,
  palette: s.appearance.palette,
  density: s.appearance.density,
})

/** Quick toggle target: the opposite of what is shown now (also when the mode is `system`). */
export const nextQuickMode = (t: ThemeState): ThemeMode => (t.resolved === DARK ? LIGHT : DARK)
