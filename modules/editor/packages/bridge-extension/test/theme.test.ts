import { describe, expect, it } from 'vitest'
import { applyTheme } from '../src/handlers/theme'
import { paletteToColorCustomizations } from '../src/palette'
import { fakeApi } from './fakes/vscode'

const COLORS = 'workbench.colorCustomizations'
const THEME = 'workbench.colorTheme'

describe('palette and theme', () => {
  it('palette maps bg and ac, omits missing tokens', () => {
    const out = paletteToColorCustomizations({ bg: '#111111', ac: '#0078d4' })
    expect(out['editor.background']).toBe('#111111')
    expect(out['button.background']).toBe('#0078d4')
    expect(out['sideBar.background']).toBeUndefined()
  })

  it('applyTheme switches theme only when different', async () => {
    const api = fakeApi()
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    expect(api.configWrites.filter((k) => k === THEME)).toHaveLength(1)
    expect(api.config.get(THEME)).toBe('Dark Modern')
  })

  it("applyTheme preserves user's own colorCustomizations keys and replaces only managed ones", async () => {
    const api = fakeApi()
    api.config.set(COLORS, { 'terminal.background': '#000000' })
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark', colors: { bg: '#111111', ac: '#222222' } })
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark', colors: { bg: '#333333' } })
    const colors = api.config.get(COLORS) as Record<string, string>
    expect(colors['terminal.background']).toBe('#000000')
    expect(colors['editor.background']).toBe('#333333')
    expect(colors['button.background']).toBeUndefined()
  })

  it('applyTheme without colors removes managed keys', async () => {
    const api = fakeApi()
    api.config.set(COLORS, { mine: '#010101' })
    await applyTheme(api, { themeName: 'Light Modern', mode: 'light', colors: { bg: '#ffffff' } })
    await applyTheme(api, { themeName: 'Light Modern', mode: 'light' })
    expect(api.config.get(COLORS)).toEqual({ mine: '#010101' })
  })
})
