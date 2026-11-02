import { palettes, sharedTokens } from '@pragma/ui/tokens'
import { describe, expect, test } from 'vitest'
import { ANSI_DARK, ANSI_LIGHT, buildXtermTheme } from '../../src/renderer/view/theme'

const ANSI_KEYS = Object.keys(ANSI_DARK)
const PALETTE_IDS = Object.keys(palettes) as (keyof typeof palettes)[]
const tokensFor = (id: keyof typeof palettes, mode: 'dark' | 'light') => ({
  ...palettes[id][mode],
  ...sharedTokens[mode],
})

/** WCAG 2.x relative luminance of `#rrggbb`. */
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

/** Body text needs 4.5:1; the near-background greys (dim text, "white") 3:1. */
const MIN_TEXT = 4.5
const MIN_DIM = 3
const DIM_KEYS = new Set(['white', 'brightWhite', 'brightBlack'])

test.each(['dark', 'light'] as const)('maps tokens to xterm theme and fills all 16 ANSI colours (%s)', (mode) => {
  const tokens = tokensFor('vscode', mode)
  const theme = buildXtermTheme(tokens, mode)
  expect(theme).toMatchObject({ foreground: tokens.tx, cursor: tokens.ac, selectionBackground: tokens.acs })
  expect(ANSI_KEYS).toHaveLength(16)
  for (const key of ANSI_KEYS) expect(theme[key as keyof typeof theme], key).toMatch(/^#[0-9a-f]{6}$/i)
})

test('dark: panel background and status colours come from tokens', () => {
  const tokens = tokensFor('vscode', 'dark')
  expect(buildXtermTheme(tokens, 'dark')).toMatchObject({
    background: tokens.pn,
    cursorAccent: tokens.pn,
    red: tokens.err,
    green: tokens.ok,
    yellow: tokens.warn,
    blue: tokens.info,
  })
})

test('light: a grey background (hover surface) and the terminal-tuned ANSI colours', () => {
  const tokens = tokensFor('vscode', 'light')
  const theme = buildXtermTheme(tokens, 'light')
  expect(theme.background).toBe(tokens.hv)
  expect(theme.cursorAccent).toBe(tokens.hv)
  expect(theme).toMatchObject({
    red: ANSI_LIGHT.red,
    green: ANSI_LIGHT.green,
    yellow: ANSI_LIGHT.yellow,
    blue: ANSI_LIGHT.blue,
  })
})

describe.each(PALETTE_IDS)('light palette %s is readable', (id) => {
  const theme = buildXtermTheme(tokensFor(id, 'light'), 'light')
  const bg = theme.background ?? ''

  test('foreground ≥ 4.5:1', () => {
    expect(contrast(theme.foreground ?? '', bg)).toBeGreaterThanOrEqual(MIN_TEXT)
  })

  test.each(ANSI_KEYS)('%s', (key) => {
    const min = DIM_KEYS.has(key) ? MIN_DIM : MIN_TEXT
    expect(contrast(theme[key as keyof typeof theme] as string, bg)).toBeGreaterThanOrEqual(min)
  })
})
