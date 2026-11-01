import type { ThemeApi, ThemeState } from '@pragma/sdk'
import { palettes, sharedTokens } from '@pragma/ui/tokens'
import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { useXtermTheme } from '../../src/renderer/view/use-xterm-theme'

function fakeTheme(initial: ThemeState) {
  let state = initial
  const listeners = new Set<(s: ThemeState) => void>()
  const api: ThemeApi = {
    get: () => state,
    onChange: (cb) => {
      listeners.add(cb)
      return { dispose: () => listeners.delete(cb) }
    },
  }
  const set = (next: ThemeState) => {
    state = next
    for (const cb of listeners) cb(next)
  }
  return { api, set }
}

const themeState = (mode: 'dark' | 'light'): ThemeState => ({
  mode,
  palette: 'vscode',
  density: 'compact',
  resolved: mode,
  tokens: { ...palettes.vscode[mode], ...sharedTokens[mode] },
})

test('re-computes when ctx.theme changes', () => {
  const theme = fakeTheme(themeState('dark'))
  const { result } = renderHook(() => useXtermTheme(theme.api))
  expect(result.current.background).toBe(palettes.vscode.dark.pn)
  act(() => theme.set(themeState('light')))
  expect(result.current.background).toBe(palettes.vscode.light.pn)
})
