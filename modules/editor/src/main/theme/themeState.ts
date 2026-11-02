import type { MainContext } from '@pragma/sdk/main'
import { type PaletteId, palettes, sharedTokens, type ThemeMode } from '@pragma/ui/tokens'
import type { EditorSetThemeMsg, EditorSettings } from '../../contract'

type Unsubscribe = () => void
type Colors = Record<string, string>

const OTHER_MODE: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'light' }

/** The same composition as the shell's theme service, for the mode that is not resolved right now. */
const tokensOf = (palette: PaletteId, mode: ThemeMode): Colors => ({
  ...palettes[palette][mode],
  ...sharedTokens[mode],
})

/** The only reader of `ctx.theme`: app theme + editor settings → the `editor.setTheme` message. */
export class ThemeState {
  readonly #theme: MainContext['theme']
  readonly #getSettings: () => EditorSettings
  readonly #onSettings: (cb: () => void) => Unsubscribe
  #rev = 0

  constructor(o: {
    theme: MainContext['theme']
    getSettings: () => EditorSettings
    onSettingsChange: (cb: () => void) => Unsubscribe
  }) {
    this.#theme = o.theme
    this.#getSettings = o.getSettings
    this.#onSettings = o.onSettingsChange
  }

  /**
   * Uses `resolved` (light/dark); `mode` can be `system` and is never used (§10.4). The palette of both modes goes
   * along, keyed by its colour theme, so the workbench never pairs one mode's theme with the other mode's palette.
   * The theme map lets the workbench pick the mode itself from `prefers-color-scheme`, which follows the app.
   */
  message(): EditorSetThemeMsg {
    return { ...this.#content(), rev: this.#rev }
  }

  #content(): EditorSetThemeMsg {
    const t = this.#theme.get()
    const s = this.#getSettings()
    const other = OTHER_MODE[t.resolved]
    // The resolved entry goes last: it wins when one colour theme is mapped to both modes.
    const colorsByTheme: Record<string, Colors> = {
      [s.themeMap[other]]: tokensOf(t.palette, other),
      [s.themeMap[t.resolved]]: { ...t.tokens },
    }
    return {
      themeName: s.themeMap[t.resolved],
      mode: t.resolved,
      ...(s.syncPalette ? { colorsByTheme } : {}),
      themeMap: { ...s.themeMap },
    }
  }

  /** Fires only when the message actually changed (theme change or themeMap/syncPalette setting); bumps `rev`. */
  onChange(cb: () => void): Unsubscribe {
    let last = JSON.stringify(this.#content())
    const check = (): void => {
      const next = JSON.stringify(this.#content())
      if (next === last) return
      last = next
      this.#rev++
      cb()
    }
    const theme = this.#theme.onChange(check)
    const settings = this.#onSettings(check)
    return () => {
      theme.dispose()
      settings()
    }
  }
}
