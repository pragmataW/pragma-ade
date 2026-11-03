import type { ThemeState } from '@pragma/sdk'
import { expect, it } from 'vitest'
import { applyTheme } from '../src/renderer/lib/apply-theme'

const state = (s: Partial<ThemeState>): ThemeState => ({
  mode: 'system',
  palette: 'vscode',
  density: 'compact',
  resolved: 'dark',
  tokens: {},
  ...s,
})

it.each([
  [state({}), { theme: 'dark', palette: 'vscode', density: 'compact' }],
  [
    state({ mode: 'light', resolved: 'light', palette: 'indigo', density: 'comfortable' }),
    { theme: 'light', palette: 'indigo', density: 'comfortable' },
  ],
  [
    state({ mode: 'system', resolved: 'light', palette: 'amber' }),
    { theme: 'light', palette: 'amber', density: 'compact' },
  ],
])('applyTheme sets data attributes (%#)', (s, expected) => {
  const root = document.createElement('html')
  applyTheme(root, s)
  expect({ ...root.dataset }).toEqual(expected)
  expect(root.style.colorScheme).toBe(expected.theme)
})
