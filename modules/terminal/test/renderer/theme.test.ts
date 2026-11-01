import { palettes, sharedTokens } from '@pragma/ui/tokens'
import { expect, test } from 'vitest'
import { ANSI_DARK, buildXtermTheme } from '../../src/renderer/view/theme'

const ANSI_KEYS = Object.keys(ANSI_DARK)

test.each(['dark', 'light'] as const)('maps tokens to xterm theme and fills all 16 ANSI colours (%s)', (mode) => {
  const tokens = { ...palettes.vscode[mode], ...sharedTokens[mode] }
  const theme = buildXtermTheme(tokens, mode)
  expect(theme).toMatchObject({
    background: tokens.pn,
    foreground: tokens.tx,
    cursor: tokens.ac,
    selectionBackground: tokens.acs,
    red: tokens.err,
    green: tokens.ok,
    yellow: tokens.warn,
    blue: tokens.info,
  })
  expect(ANSI_KEYS).toHaveLength(16)
  for (const key of ANSI_KEYS) expect(theme[key as keyof typeof theme], key).toMatch(/^#[0-9a-f]{6}$/i)
})
