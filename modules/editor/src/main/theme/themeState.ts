import type { MainContext } from '@pragma/sdk/main'
import type { EditorSetThemeMsg, EditorSettings } from '../../contract'

type Unsubscribe = () => void

/** The only reader of `ctx.theme`: app theme + editor settings → the `editor.setTheme` message. */
export class ThemeState {
  readonly #theme: MainContext['theme']
  readonly #getSettings: () => EditorSettings
  readonly #onSettings: (cb: () => void) => Unsubscribe

  constructor(o: {
    theme: MainContext['theme']
    getSettings: () => EditorSettings
    onSettingsChange: (cb: () => void) => Unsubscribe
  }) {
    this.#theme = o.theme
    this.#getSettings = o.getSettings
    this.#onSettings = o.onSettingsChange
  }

  /** Uses `resolved` (light/dark); `mode` can be `system` and is never used (§10.4). */
  message(): EditorSetThemeMsg {
    const t = this.#theme.get()
    const s = this.#getSettings()
    return {
      themeName: s.themeMap[t.resolved],
      mode: t.resolved,
      ...(s.syncPalette ? { colors: { ...t.tokens } } : {}),
    }
  }

  /** Fires only when `message()` actually changed (theme change or themeMap/syncPalette setting). */
  onChange(cb: () => void): Unsubscribe {
    let last = JSON.stringify(this.message())
    const check = (): void => {
      const next = JSON.stringify(this.message())
      if (next === last) return
      last = next
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
