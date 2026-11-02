import { type PaletteId, palettes, sharedTokens } from '@pragma/ui/tokens'
import { describe, expect, it } from 'vitest'
import { type EditorSettings, editorSettingsDefaults } from '../src/contract'
import { ThemeState } from '../src/main/theme/themeState'

type T = {
  mode: 'system' | 'light' | 'dark'
  resolved: 'light' | 'dark'
  palette?: PaletteId
  tokens: Record<string, string>
}

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
    const m = state.message()
    expect(m).toMatchObject({ themeName: 'Dark Modern', mode: 'dark' })
    expect(m.colorsByTheme?.['Dark Modern']).toEqual({ bg: '#1e1e1e' })
  })

  it('carries the palette of both modes, each keyed by its colour theme', () => {
    const { state } = setup({ mode: 'dark', resolved: 'dark', palette: 'dark-brown', tokens: { bg: '#1c1714' } })
    const m = state.message()
    expect(m.colorsByTheme?.['Dark Modern']).toEqual({ bg: '#1c1714' })
    expect(m.colorsByTheme?.['Light Modern']).toMatchObject({
      ...palettes['dark-brown'].light,
      ...sharedTokens.light,
    })
  })

  it('one colour theme for both modes gets the resolved palette', () => {
    const { state } = setup(
      { mode: 'light', resolved: 'light', tokens: { bg: '#ffffff' } },
      { themeMap: { dark: 'Same', light: 'Same' } },
    )
    expect(state.message().colorsByTheme).toEqual({ Same: { bg: '#ffffff' } })
  })

  it('onChange fires on a palette change', () => {
    const t = setup({ mode: 'dark', resolved: 'dark', tokens: {} })
    let fired = 0
    t.state.onChange(() => fired++)
    t.setTheme({ palette: 'amber' })
    expect(fired).toBe(1)
  })

  it('syncPalette false → no colors', () => {
    const { state } = setup({ mode: 'light', resolved: 'light', tokens: { bg: '#fff' } }, { syncPalette: false })
    expect(state.message()).toEqual({
      themeName: 'Light Modern',
      mode: 'light',
      themeMap: { dark: 'Dark Modern', light: 'Light Modern' },
      rev: 0,
    })
  })

  it('carries the theme map, so the workbench follows the view colour scheme without a write per switch', () => {
    const { state } = setup({ mode: 'dark', resolved: 'dark', tokens: {} }, { themeMap: { dark: 'D', light: 'L' } })
    expect(state.message().themeMap).toEqual({ dark: 'D', light: 'L' })
  })

  it('rev grows with every change, so an extension can drop a stale hello reply', () => {
    const t = setup({ mode: 'dark', resolved: 'dark', tokens: {} })
    t.state.onChange(() => undefined)
    expect(t.state.message().rev).toBe(0)
    t.setTheme({ resolved: 'light', mode: 'light' })
    expect(t.state.message().rev).toBe(1)
    t.setSettings({ maxOpenViews: 2 })
    expect(t.state.message().rev).toBe(1)
    t.setTheme({ palette: 'amber' })
    expect(t.state.message().rev).toBe(2)
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
