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

export const ANSI_LIGHT: Record<AnsiName, string> = {
  black: '#000000',
  red: '#cd3131',
  green: '#00bc00',
  yellow: '#949800',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#555555',
  brightBlack: '#666666',
  brightRed: '#cd3131',
  brightGreen: '#14ce14',
  brightYellow: '#b5ba00',
  brightBlue: '#0451a5',
  brightMagenta: '#bc05bc',
  brightCyan: '#0598bc',
  brightWhite: '#a5a5a5',
}

/** xterm theme keys taken from design tokens (`ctx.theme` tokens, ui-notes "Color tokens"). */
const TOKEN_MAP = {
  background: 'pn',
  foreground: 'tx',
  cursor: 'ac',
  cursorAccent: 'pn',
  selectionBackground: 'acs',
  red: 'err',
  green: 'ok',
  yellow: 'warn',
  blue: 'info',
} as const satisfies Partial<Record<keyof ITheme, string>>

/** The app palette in xterm form: surfaces and status colours from tokens, the other ANSI colours VS Code's. */
export function buildXtermTheme(tokens: Readonly<Record<string, string>>, mode: ThemeMode): ITheme {
  const theme: ITheme = { ...(mode === 'dark' ? ANSI_DARK : ANSI_LIGHT) }
  for (const [key, token] of Object.entries(TOKEN_MAP)) {
    const value = tokens[token]
    if (value) theme[key as keyof typeof TOKEN_MAP] = value
  }
  return theme
}
