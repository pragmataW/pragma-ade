import { describe, expect, it } from 'vitest'
import { type EditorSettings, editorSettingsDefaults } from '../src/contract'
import { ThemeState } from '../src/main/theme/themeState'

type T = { mode: 'system' | 'light' | 'dark'; resolved: 'light' | 'dark'; tokens: Record<string, string> }

function setup(initial: T, settings: Partial<EditorSettings> = {}) {
  let theme = { palette: 'vscode', density: 'compact', ...initial }
  let s: EditorSettings = { ...editorSettingsDefaults, ...settings }
  const themeCbs = new Set<() => void>()
  const settingsCbs = new Set<() => void>()
  const state = new ThemeState({
    theme: {
      get: () => theme as never,
      onChange: (cb) => {
        themeCbs.add(cb as () => void)
        return { dispose: () => themeCbs.delete(cb as () => void) }
      },
    },
    getSettings: () => s,
    onSettingsChange: (cb) => {
      settingsCbs.add(cb)
      return () => settingsCbs.delete(cb)
    },
  })
  return {
    state,
    setTheme(t: Partial<T>) {
      theme = { ...theme, ...t }
      for (const cb of themeCbs) cb()
    },
    setSettings(p: Partial<EditorSettings>) {
      s = { ...s, ...p }
      for (const cb of settingsCbs) cb()
    },
  }
}

describe('ThemeState', () => {
  it("message uses resolved (mode 'system', resolved 'dark' → themeMap.dark) and includes tokens when syncPalette", () => {
    const { state } = setup({ mode: 'system', resolved: 'dark', tokens: { bg: '#1e1e1e' } })
    expect(state.message()).toEqual({ themeName: 'Dark Modern', mode: 'dark', colors: { bg: '#1e1e1e' } })
  })

  it('syncPalette false → no colors', () => {
    const { state } = setup({ mode: 'light', resolved: 'light', tokens: { bg: '#fff' } }, { syncPalette: false })
    expect(state.message()).toEqual({ themeName: 'Light Modern', mode: 'light' })
  })

  it('onChange fires on theme change and on themeMap change, not on unrelated settings', () => {
    const t = setup({ mode: 'dark', resolved: 'dark', tokens: {} })
    let fired = 0
    t.state.onChange(() => fired++)
    t.setTheme({ resolved: 'light', mode: 'light' })
    expect(fired).toBe(1)
    t.setSettings({ maxOpenViews: 2 })
    expect(fired).toBe(1)
    t.setSettings({ themeMap: { dark: 'Dark+', light: 'Light+' } })
    expect(fired).toBe(2)
  })
})
