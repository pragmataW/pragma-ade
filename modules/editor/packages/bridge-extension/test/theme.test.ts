import { describe, expect, it } from 'vitest'
import { applyTheme, newerThemesOnly, nextCustomizations } from '../src/handlers/theme'
import { LatestQueue } from '../src/latestQueue'
import { paletteToColorCustomizations } from '../src/palette'
import { fakeApi } from './fakes/vscode'

const COLORS = 'workbench.colorCustomizations'
const THEME = 'workbench.colorTheme'
const DARK = '[Dark Modern]'
const LIGHT = '[Light Modern]'
const BG = 'editor.background'
const dark = (colors: Record<string, string>) => ({
  themeName: 'Dark Modern',
  mode: 'dark' as const,
  colorsByTheme: { 'Dark Modern': colors },
})
type Colors = Record<string, string> & Record<string, Record<string, string> | undefined>
const colorsOf = (api: ReturnType<typeof fakeApi>) => api.config.get(COLORS) as Colors

describe('palette and theme', () => {
  it('palette maps bg and ac, omits missing tokens', () => {
    const out = paletteToColorCustomizations({ bg: '#111111', ac: '#0078d4' })
    expect(out[BG]).toBe('#111111')
    expect(out['button.background']).toBe('#0078d4')
    expect(out['sideBar.background']).toBeUndefined()
  })

  it('colours the inactive title bar and selection too (the workbench is unfocused while the app has focus)', () => {
    const out = paletteToColorCustomizations({ sb: '#16120f', hv: '#30271f' })
    expect(out['titleBar.inactiveBackground']).toBe('#16120f')
    expect(out['titleBar.activeBackground']).toBe('#16120f')
    expect(out['list.inactiveSelectionBackground']).toBe('#30271f')
  })

  it('applyTheme switches theme only when different', async () => {
    const api = fakeApi()
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    expect(api.configWrites.filter((k) => k === THEME)).toHaveLength(1)
    expect(api.config.get(THEME)).toBe('Dark Modern')
  })

  it('writes each palette into its theme block, never at the top level', async () => {
    const api = fakeApi()
    await applyTheme(api, {
      themeName: 'Light Modern',
      mode: 'light',
      colorsByTheme: { 'Dark Modern': { bg: '#1c1714' }, 'Light Modern': { bg: '#fbf7f2' } },
    })
    const colors = colorsOf(api)
    expect(Object.keys(colors).sort()).toEqual([DARK, LIGHT])
    expect(colors[DARK]?.[BG]).toBe('#1c1714')
    expect(colors[LIGHT]?.[BG]).toBe('#fbf7f2')
    expect(api.config.get(THEME)).toBe('Light Modern')
  })

  it('a mode switch with the same palette is a single colorTheme write', async () => {
    const api = fakeApi()
    const both = { 'Dark Modern': { bg: '#1e1e1e' }, 'Light Modern': { bg: '#ffffff' } }
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark', colorsByTheme: both })
    api.configWrites.length = 0
    await applyTheme(api, { themeName: 'Light Modern', mode: 'light', colorsByTheme: both })
    expect(api.configWrites).toEqual([THEME])
  })

  it("preserves the user's own keys, top level and inside theme blocks, and replaces only managed ones", async () => {
    const api = fakeApi()
    api.config.set(COLORS, { 'terminal.background': '#000000', [DARK]: { 'editorCursor.foreground': '#ff0000' } })
    await applyTheme(api, dark({ bg: '#111111', ac: '#222222' }))
    await applyTheme(api, dark({ bg: '#333333' }))
    const colors = colorsOf(api)
    expect(colors['terminal.background']).toBe('#000000')
    expect(colors[DARK]?.['editorCursor.foreground']).toBe('#ff0000')
    expect(colors[DARK]?.[BG]).toBe('#333333')
    expect(colors[DARK]?.['button.background']).toBeUndefined()
  })

  it('applyTheme without colors removes managed keys and the blocks they leave empty', async () => {
    const api = fakeApi()
    api.config.set(COLORS, { mine: '#010101' })
    await applyTheme(api, dark({ bg: '#ffffff' }))
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    expect(api.config.get(COLORS)).toEqual({ mine: '#010101' })
  })

  it('removes top-level keys written by older versions (they painted one palette over both themes)', async () => {
    const api = fakeApi()
    api.config.set(COLORS, { mine: '#010101', [BG]: '#1e1e1e' })
    api.state.set('pragma.managedColorKeys', [BG])
    await applyTheme(api, dark({ bg: '#1c1714' }))
    const colors = colorsOf(api)
    expect(colors.mine).toBe('#010101')
    expect(colors[BG]).toBeUndefined()
    expect(colors[DARK]?.[BG]).toBe('#1c1714')
    expect(api.state.get('pragma.managedColorKeys')).toBeUndefined()
  })

  it('retries when a write fails or another workbench overwrites it with an older value', async () => {
    const api = fakeApi()
    const write = api.updateGlobalConfig
    let calls = 0
    api.updateGlobalConfig = async (section, key, value) => {
      calls++
      if (calls === 1) throw new Error('file modified since')
      await write(section, key, value)
      if (key === 'colorTheme' && api.configWrites.filter((k) => k === THEME).length === 1)
        await write(section, key, 'Light Modern')
    }
    await applyTheme(api, dark({ bg: '#1c1714' }))
    expect(api.config.get(THEME)).toBe('Dark Modern')
    expect(colorsOf(api)[DARK]?.[BG]).toBe('#1c1714')
  })

  it('throws when another workbench keeps undoing the write (the failure is logged, not swallowed)', async () => {
    const api = fakeApi()
    const write = api.updateGlobalConfig
    api.updateGlobalConfig = async (section, key, value) => {
      await write(section, key, value)
      if (key === 'colorTheme') await write(section, key, 'Light Modern')
    }
    await expect(applyTheme(api, dark({ bg: '#1c1714' }))).rejects.toThrow(/not applied/)
  })

  it('keeps a user block Pragma wrote nothing into', () => {
    const { next, managed } = nextCustomizations({ [LIGHT]: { x: '#1' } }, { [LIGHT]: ['y'] }, dark({ bg: '#2' }))
    expect(next[LIGHT]).toEqual({ x: '#1' })
    expect(Object.keys(managed)).toEqual([DARK])
  })
})

describe('following the app colour scheme', () => {
  const AUTO = 'window.autoDetectColorScheme'
  const PREF_DARK = 'workbench.preferredDarkColorTheme'
  const PREF_LIGHT = 'workbench.preferredLightColorTheme'
  const themeMap = { dark: 'Dark Modern', light: 'Light Modern' }
  const both = { 'Dark Modern': { bg: '#1e1e1e' }, 'Light Modern': { bg: '#ffffff' } }
  const follow = (mode: 'dark' | 'light') => ({
    themeName: themeMap[mode],
    mode,
    themeMap,
    colorsByTheme: both,
  })

  it('maps both modes to preferred themes and turns on autodetect last (the workbench follows the view)', async () => {
    const api = fakeApi()
    await applyTheme(api, follow('dark'))
    expect(api.config.get(PREF_DARK)).toBe('Dark Modern')
    expect(api.config.get(PREF_LIGHT)).toBe('Light Modern')
    expect(api.config.get(AUTO)).toBe(true)
    expect(api.configWrites.at(-1)).toBe(AUTO)
    expect(api.configWrites).not.toContain(THEME)
  })

  it('a mode switch writes nothing: no settings race between workbenches, hidden or not', async () => {
    const api = fakeApi()
    await applyTheme(api, follow('dark'))
    api.configWrites.length = 0
    await applyTheme(api, follow('light'))
    await applyTheme(api, follow('dark'))
    expect(api.configWrites).toEqual([])
  })

  it('an override without a theme map pins colorTheme and turns autodetect off after it', async () => {
    const api = fakeApi()
    await applyTheme(api, follow('dark'))
    api.configWrites.length = 0
    await applyTheme(api, { themeName: 'Light Modern', mode: 'light' })
    expect(api.config.get(THEME)).toBe('Light Modern')
    expect(api.config.get(AUTO)).toBe(false)
    expect(api.configWrites.slice(-2)).toEqual([THEME, AUTO])
  })

  it('an override leaves autodetect alone when it was never set (false is the default)', async () => {
    const api = fakeApi()
    await applyTheme(api, { themeName: 'Dark Modern', mode: 'dark' })
    expect(api.configWrites).not.toContain(AUTO)
  })
})

describe('newerThemesOnly', () => {
  const m = (rev?: number) => ({ themeName: 'x', mode: 'dark' as const, ...(rev === undefined ? {} : { rev }) })

  it('drops a theme older than one already accepted (a hello reply overtaken by a broadcast)', () => {
    const accept = newerThemesOnly()
    expect(accept(m(3))).toBe(true)
    expect(accept(m(2))).toBe(false)
    expect(accept(m(3))).toBe(true)
    expect(accept(m(4))).toBe(true)
  })

  it('always accepts messages without a revision (overrides)', () => {
    const accept = newerThemesOnly()
    expect(accept(m(5))).toBe(true)
    expect(accept(m())).toBe(true)
  })
})

describe('LatestQueue', () => {
  it('runs one task at a time and skips values replaced while waiting', async () => {
    const ran: number[] = []
    let active = 0
    let maxActive = 0
    const q = new LatestQueue<number>(
      async (n) => {
        active++
        maxActive = Math.max(maxActive, active)
        await new Promise((r) => setTimeout(r, 5))
        ran.push(n)
        active--
      },
      () => undefined,
    )
    await Promise.all([1, 2, 3, 4].map((n) => q.push(n)))
    expect(ran).toEqual([1, 4])
    expect(maxActive).toBe(1)
  })

  it('a failing task does not stop the next one', async () => {
    const errors: unknown[] = []
    const ran: number[] = []
    const q = new LatestQueue<number>(
      async (n) => {
        if (n === 1) throw new Error('boom')
        ran.push(n)
      },
      (e) => errors.push(e),
    )
    void q.push(1)
    await q.push(2)
    expect(ran).toEqual([2])
    expect(errors).toHaveLength(1)
  })
})
