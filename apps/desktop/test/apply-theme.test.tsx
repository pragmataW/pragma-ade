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

it.each([
  ['darwin', 'native'],
  ['linux', 'css'],
  ['win32', 'css'],
])('the glass palette on %s gets the %s backdrop', (platform, backdrop) => {
  const root = document.createElement('html')
  applyTheme(root, state({ palette: 'glass' }), platform)
  expect({ ...root.dataset }).toEqual({ theme: 'dark', palette: 'glass', density: 'compact', backdrop })
})

it('leaving glass drops the backdrop attribute', () => {
  const root = document.createElement('html')
  applyTheme(root, state({ palette: 'glass', resolved: 'light' }), 'darwin')
  applyTheme(root, state({ palette: 'vscode' }), 'darwin')
  expect(root.dataset.backdrop).toBeUndefined()
  expect(root.dataset.palette).toBe('vscode')
})
