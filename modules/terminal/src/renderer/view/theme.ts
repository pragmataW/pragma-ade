import type { ThemeMode } from '@pragma/sdk'
import type { ITheme } from '@xterm/xterm'

type AnsiName =
  | 'black'
  | 'red'
  | 'green'
  | 'yellow'
  | 'blue'
  | 'magenta'
  | 'cyan'
  | 'white'
  | 'brightBlack'
  | 'brightRed'
  | 'brightGreen'
  | 'brightYellow'
  | 'brightBlue'
  | 'brightMagenta'
  | 'brightCyan'
  | 'brightWhite'

/** VS Code's default integrated-terminal ANSI colours. */
export const ANSI_DARK: Record<AnsiName, string> = {
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#e5e5e5',
}

/**
 * Light ANSI colours tuned for the grey light background (`hv`): every colour reaches WCAG 4.5:1 on all light
 * palettes, the greys (`white`, `brightWhite`, `brightBlack`) 3:1. VS Code's light defaults (yellow, green, cyan
 * around 2:1) are unreadable there, and so are the app's `ok`/`warn` tokens, so light mode keeps these status colours.
 */
export const ANSI_LIGHT: Record<AnsiName, string> = {
  black: '#000000',
  red: '#b42020',
  green: '#0b6e0b',
  yellow: '#735c00',
  blue: '#0451a5',
  magenta: '#a2129f',
  cyan: '#06657e',
  white: '#5a5a5a',
  brightBlack: '#6b6b6b',
  brightRed: '#b8302f',
  brightGreen: '#11702a',
  brightYellow: '#785c00',
  brightBlue: '#1a5fc0',
  brightMagenta: '#9c2c9c',
  brightCyan: '#0b6d88',
  brightWhite: '#7c7c7c',
}

type TokenMap = Partial<Record<keyof ITheme, string>>

/** xterm theme keys taken from design tokens (`ctx.theme` tokens, ui-notes "Color tokens"). */
const TOKEN_MAP_DARK = {
  background: 'pn',
  foreground: 'tx',
  cursor: 'ac',
  cursorAccent: 'pn',
  selectionBackground: 'acs',
  red: 'err',
  green: 'ok',
  yellow: 'warn',
  blue: 'info',
} as const satisfies TokenMap

/** Light: the grey hover surface instead of the near-white panel; status colours stay `ANSI_LIGHT`'s. */
const TOKEN_MAP_LIGHT = {
  background: 'hv',
  foreground: 'tx',
  cursor: 'ac',
  cursorAccent: 'hv',
  selectionBackground: 'acs',
} as const satisfies TokenMap

/** The app palette in xterm form: surfaces from tokens, ANSI colours per mode (status colours from tokens in dark). */
export function buildXtermTheme(tokens: Readonly<Record<string, string>>, mode: ThemeMode): ITheme {
  const dark = mode === 'dark'
  const theme: Record<string, string> = { ...(dark ? ANSI_DARK : ANSI_LIGHT) }
  const map: TokenMap = dark ? TOKEN_MAP_DARK : TOKEN_MAP_LIGHT
  for (const [key, token] of Object.entries(map)) {
    const value = tokens[token]
    if (value) theme[key] = value
  }
  return theme
}
