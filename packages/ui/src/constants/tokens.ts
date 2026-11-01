/** Design tokens copied verbatim from docs/design/ui-notes.md ("Color tokens"); the single source of truth (§10.2). */

export const PALETTE_IDS = ['vscode', 'dark-brown', 'amber', 'indigo'] as const
export const THEME_MODES = ['light', 'dark'] as const
export const DENSITIES = ['compact', 'comfortable'] as const
export type PaletteId = (typeof PALETTE_IDS)[number]
export type ThemeMode = (typeof THEME_MODES)[number]
export type Density = (typeof DENSITIES)[number]

export const PALETTE_TOKEN_NAMES = [
  'bg',
  'sb',
  'pn',
  'el',
  'hv',
  'bd',
  'bd2',
  'tx',
  'mu',
  'fa',
  'ac',
  'acfg',
  'acs',
  'act',
] as const
export const SHARED_TOKEN_NAMES = [
  'ok',
  'warn',
  'err',
  'info',
  'add-bg',
  'add-gutter',
  'add-tx',
  'del-bg',
  'del-gutter',
  'del-tx',
  'syn-kw',
  'syn-fn',
  'syn-str',
  'syn-type',
  'syn-num',
  'syn-comment',
  'syn-tag',
  'picker',
  'scrim',
] as const
export type PaletteTokenName = (typeof PALETTE_TOKEN_NAMES)[number]
export type SharedTokenName = (typeof SHARED_TOKEN_NAMES)[number]
export type TokenName = PaletteTokenName | SharedTokenName

type PaletteValues = Record<PaletteTokenName, string>
type Row = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

const row = (values: Row): PaletteValues =>
  Object.fromEntries(PALETTE_TOKEN_NAMES.map((name, i) => [name, values[i]])) as PaletteValues

export const palettes: Record<PaletteId, Record<ThemeMode, PaletteValues>> = {
  vscode: {
    dark: row([
      '#1e1e1e',
      '#181818',
      '#1f1f1f',
      '#252526',
      '#2a2d2e',
      '#2b2b2b',
      '#3c3c3c',
      '#cccccc',
      '#a0a0a0',
      '#8b8b8b',
      '#0078d4',
      '#ffffff',
      '#0d2c45',
      '#4daafc',
    ]),
    light: row([
      '#ffffff',
      '#f8f8f8',
      '#f8f8f8',
      '#ffffff',
      '#ececec',
      '#e5e5e5',
      '#cecece',
      '#1f1f1f',
      '#5f5f5f',
      '#6e6e6e',
      '#005fb8',
      '#ffffff',
      '#dbe9f8',
      '#005fb8',
    ]),
  },
  'dark-brown': {
    dark: row([
      '#1c1714',
      '#16120f',
      '#1f1a16',
      '#29211c',
      '#30271f',
      '#342a21',
      '#4a3c2f',
      '#ebe2d8',
      '#b8a999',
      '#9a8b7d',
      '#c4895a',
      '#1c1410',
      '#3b2b1e',
      '#dca878',
    ]),
    light: row([
      '#fbf7f2',
      '#f3ece4',
      '#f6f0e9',
      '#ffffff',
      '#ebe2d7',
      '#e4d9cc',
      '#d2c3b2',
      '#2b211a',
      '#65554a',
      '#6f5e50',
      '#8a5a33',
      '#ffffff',
      '#f1e2d2',
      '#7a4d2a',
    ]),
  },
  amber: {
    dark: row([
      '#141414',
      '#0f0f0f',
      '#171717',
      '#1f1f1f',
      '#252525',
      '#262626',
      '#383838',
      '#ededed',
      '#a8a8a8',
      '#8f8f8f',
      '#f59e0b',
      '#1a1205',
      '#2f2410',
      '#fbbf24',
    ]),
    light: row([
      '#ffffff',
      '#fafaf9',
      '#fafaf9',
      '#ffffff',
      '#f1f0ee',
      '#e7e5e4',
      '#d6d3d1',
      '#1c1917',
      '#57534e',
      '#68625c',
      '#b45309',
      '#ffffff',
      '#fdf0dc',
      '#a14a07',
    ]),
  },
  indigo: {
    dark: row([
      '#13141b',
      '#0f1016',
      '#161720',
      '#1d1e29',
      '#232434',
      '#272938',
      '#363950',
      '#e6e7f0',
      '#a5a8bf',
      '#8d90a8',
      '#5b5bd6',
      '#ffffff',
      '#262852',
      '#a7a9ff',
    ]),
    light: row([
      '#ffffff',
      '#f8f8fc',
      '#f8f8fc',
      '#ffffff',
      '#eeeef7',
      '#e4e4ef',
      '#d0d1e2',
      '#1a1b2e',
      '#55587a',
      '#646786',
      '#4f46e5',
      '#ffffff',
      '#e9e8fd',
      '#4338ca',
    ]),
  },
}

export const sharedTokens: Record<ThemeMode, Record<SharedTokenName, string>> = {
  dark: {
    ok: '#3fb950',
    warn: '#e3b341',
    err: '#f85149',
    info: '#58a6ff',
    'add-bg': 'rgba(46,160,67,.16)',
    'add-gutter': 'rgba(46,160,67,.24)',
    'add-tx': '#56d364',
    'del-bg': 'rgba(248,81,73,.15)',
    'del-gutter': 'rgba(248,81,73,.22)',
    'del-tx': '#ff7b72',
    'syn-kw': '#c678dd',
    'syn-fn': '#61afef',
    'syn-str': '#98c379',
    'syn-type': '#e5c07b',
    'syn-num': '#d19a66',
    'syn-comment': '#7f848e',
    'syn-tag': '#e06c75',
    picker: 'color-mix(in srgb, var(--ac) 15%, transparent)',
    scrim: 'rgba(0,0,0,.55)',
  },
  light: {
    ok: '#1a7f37',
    warn: '#9a6700',
    err: '#cf222e',
    info: '#0969da',
    'add-bg': 'rgba(26,127,55,.10)',
    'add-gutter': 'rgba(26,127,55,.18)',
    'add-tx': '#1a7f37',
    'del-bg': 'rgba(207,34,46,.09)',
    'del-gutter': 'rgba(207,34,46,.16)',
    'del-tx': '#cf222e',
    'syn-kw': '#a626a4',
    'syn-fn': '#3b6fd8',
    'syn-str': '#3f8a3e',
    'syn-type': '#986801',
    'syn-num': '#986801',
    'syn-comment': '#6a737d',
    'syn-tag': '#c0392b',
    picker: 'color-mix(in srgb, var(--ac) 12%, transparent)',
    scrim: 'rgba(20,20,20,.30)',
  },
}

/** Layout sizes from ui-notes ("Layout", "Shape & spacing"), in px. */
export const LAYOUT = {
  windowWidth: 1440,
  windowHeight: 900,
  titleBar: 38,
  statusBar: 24,
  sidebar: 248,
  sidebarMin: 180,
  rightPanel: 420,
  rightPanelWide: 780,
  rightPanelMin: 280,
  centerMin: 380,
  tabStrip: 40,
  settingsNav: 220,
  treeRow: 22,
  treeIndent: 12,
  worktreeIndent: 22,
  radiusChip: 4,
  radiusButton: 6,
  radiusCard: 8,
  radiusPopover: 10,
  radiusDialog: 12,
} as const

export interface DensityMetrics {
  controlPx: number
  iconButtonPx: number
  rowPx: number
  gapPx: number
  textPx: number
}

export const DENSITY_METRICS: Record<Density, DensityMetrics> = {
  compact: { controlPx: 28, iconButtonPx: 26, rowPx: 22, gapPx: 8, textPx: 13 },
  comfortable: { controlPx: 32, iconButtonPx: 30, rowPx: 26, gapPx: 10, textPx: 14 },
}

export const FONT_SANS = "'Inter Variable', Inter, system-ui, sans-serif"
export const FONT_MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace"
