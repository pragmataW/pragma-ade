import { palettes, sharedTokens } from '@pragma/ui/tokens'
import { expect, test, vi } from 'vitest'
import { createThemeService } from '../src/runtime/main/theme-service'
import { createFakePlatform } from './lib/fake-platform'

test('defaults to system/vscode/compact resolved from the OS', () => {
  const platform = createFakePlatform({ dark: true })
  const theme = createThemeService(platform.theme)
  expect(theme.get()).toMatchObject({ mode: 'system', palette: 'vscode', density: 'compact', resolved: 'dark' })
  expect(theme.get().tokens.bg).toBe(palettes.vscode.dark.bg)
})
test('theme set resolves via shouldUseDark and builds tokens for palette', () => {
  const platform = createFakePlatform({ dark: true })
  const theme = createThemeService(platform.theme)
  theme.set({ mode: 'light', palette: 'indigo', density: 'comfortable' })
  expect(platform.themeSource()).toBe('light')
  expect(theme.get()).toMatchObject({ resolved: 'light', palette: 'indigo', density: 'comfortable' })
  expect(theme.get().tokens).toEqual({ ...palettes.indigo.light, ...sharedTokens.light })
})
test('theme onUpdated re-resolves and notifies', () => {
  const platform = createFakePlatform({ dark: false })
  const theme = createThemeService(platform.theme)
  const cb = vi.fn()
  theme.onChange(cb)
  platform.setDark(true)
  expect(theme.get().resolved).toBe('dark')
  expect(cb).toHaveBeenCalledOnce()
  platform.setDark(true)
  expect(cb).toHaveBeenCalledOnce()
  theme.dispose()
})
