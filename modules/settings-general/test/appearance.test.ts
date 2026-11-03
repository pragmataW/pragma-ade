import { join } from 'node:path'
import { createFakePlatform, createTestModuleHost, loadModuleRecord, type TestModuleHost } from '@pragma/test-support'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GENERAL_SETTINGS_DEFAULTS, type GeneralSettings, SETTINGS_GENERAL_ID } from '../src/contract'
import { nextQuickMode, toThemeInput } from '../src/lib/appearance'

const DIR = join(import.meta.dirname, '..')
let t: TestModuleHost | undefined

afterEach(async () => {
  await t?.dispose()
  t = undefined
})

async function start(opts: { settings?: Record<string, unknown>; dark?: boolean } = {}) {
  const platform = createFakePlatform({ dark: opts.dark ?? true })
  t = await createTestModuleHost({ modules: [await loadModuleRecord(DIR)], settings: opts.settings, platform })
  return { host: t.host, platform }
}

const section = () => t?.host.settings.get<GeneralSettings>(SETTINGS_GENERAL_ID)

describe('settings-general appearance', () => {
  it('defaults system/vscode/compact/en', async () => {
    const { host, platform } = await start()
    expect(section()).toEqual(GENERAL_SETTINGS_DEFAULTS)
    expect(host.theme.get()).toMatchObject({ mode: 'system', palette: 'vscode', density: 'compact', resolved: 'dark' })
    expect(platform.themeSource()).toBe('system')
  })

  it('invalid stored mode falls back', async () => {
    const { host } = await start({
      settings: { [SETTINGS_GENERAL_ID]: { appearance: { mode: 'sepia', palette: 'amber' }, language: 'en' } },
    })
    expect(section()?.appearance).toEqual({ mode: 'system', palette: 'amber', density: 'compact' })
    expect(host.theme.get().palette).toBe('amber')
  })

  it('settings change drives ThemeControllerToken → host.theme state and fake platform themeSource', async () => {
    const { host, platform } = await start()
    host.settings.update(SETTINGS_GENERAL_ID, {
      appearance: { mode: 'light', palette: 'indigo', density: 'comfortable' },
    })
    expect(host.theme.get()).toMatchObject({
      mode: 'light',
      resolved: 'light',
      palette: 'indigo',
      density: 'comfortable',
    })
    expect(platform.themeSource()).toBe('light')
  })

  it('fake platform dark flip under system mode updates host.theme.resolved', async () => {
    const { host, platform } = await start({ dark: false })
    expect(host.theme.get().resolved).toBe('light')
    platform.setDark(true)
    expect(host.theme.get().resolved).toBe('dark')
  })

  it('language change calls i18n.changeLanguage', async () => {
    const { host } = await start()
    const changed: string[] = []
    host.i18n.onLanguageChanged((lng) => changed.push(lng))
    host.settings.update(SETTINGS_GENERAL_ID, { language: 'de' })
    await vi.waitFor(() => expect(changed).toEqual(['de']))
    expect(host.i18n.language()).toBe('de')
  })
})

describe('appearance helpers', () => {
  it('toThemeInput picks mode, palette and density', () =>
    expect(toThemeInput(GENERAL_SETTINGS_DEFAULTS)).toEqual({ mode: 'system', palette: 'vscode', density: 'compact' }))
  it.each([
    ['dark', 'light'],
    ['light', 'dark'],
  ] as const)('nextQuickMode(%s) is %s', (resolved, next) =>
    expect(nextQuickMode({ mode: 'system', palette: 'vscode', density: 'compact', resolved, tokens: {} })).toBe(next),
  )
})
