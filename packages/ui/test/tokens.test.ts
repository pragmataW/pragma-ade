import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  DENSITIES,
  DENSITY_METRICS,
  isTranslucentPalette,
  PALETTE_IDS,
  type PaletteId,
  palettes,
  sharedTokens,
  THEME_MODES,
} from '../src/constants/tokens'

const styles = join(import.meta.dirname, '../src/styles')
const css = (file: string) => readFileSync(join(styles, file), 'utf8')

/** `--name: value;` declarations of the block whose selector is exactly `selector`. */
function block(text: string, selector: string): Record<string, string> {
  const start = text.indexOf(`${selector} {`)
  if (start < 0) return {}
  const body = text.slice(start + selector.length + 2, text.indexOf('}', start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]?.trim()]))
}

const combos = PALETTE_IDS.flatMap((p) => THEME_MODES.map((m) => [p, m] as const))
/** Translucent palettes live in their own stylesheet (base colours first, then the glass layer). */
const paletteFile = (palette: PaletteId): string => (isTranslucentPalette(palette) ? 'glass.css' : 'tokens.css')

describe('tokens.css matches tokens.ts', () => {
  it.each(combos)('%s / %s', (palette, mode) => {
    expect(block(css(paletteFile(palette)), `:root[data-palette="${palette}"][data-theme="${mode}"]`)).toEqual(
      palettes[palette][mode],
    )
  })
  it.each(THEME_MODES)('shared tokens for %s', (mode) => {
    expect(block(css('tokens.css'), `:root[data-theme="${mode}"]`)).toEqual(sharedTokens[mode])
  })
})

it.each([
  ['vscode', 'dark', 'bg', '#1e1e1e'],
  ['vscode', 'light', 'ac', '#005fb8'],
  ['dark-brown', 'dark', 'ac', '#c4895a'],
  ['dark-brown', 'light', 'act', '#7a4d2a'],
  ['amber', 'dark', 'acfg', '#1a1205'],
  ['amber', 'light', 'fa', '#68625c'],
  ['indigo', 'dark', 'act', '#a7a9ff'],
  ['indigo', 'light', 'bd2', '#d0d1e2'],
] as const)('ui-notes spot value %s/%s --%s', (palette, mode, token, value) => {
  expect(palettes[palette][mode][token]).toBe(value)
})
it.each([
  ['dark', 'ok', '#3fb950'],
  ['light', 'warn', '#9a6700'],
  ['dark', 'del-gutter', 'rgba(248,81,73,.22)'],
  ['light', 'syn-kw', '#a626a4'],
  ['dark', 'picker', 'color-mix(in srgb, var(--ac) 15%, transparent)'],
  ['light', 'picker', 'color-mix(in srgb, var(--ac) 12%, transparent)'],
  ['light', 'scrim', 'rgba(20,20,20,.30)'],
] as const)('ui-notes shared spot value %s --%s', (mode, token, value) => {
  expect(sharedTokens[mode][token]).toBe(value)
})

it.each(DENSITIES)('density.css matches DENSITY_METRICS (%s)', (density) => {
  const m = DENSITY_METRICS[density]
  expect(block(css('density.css'), `:root[data-density="${density}"]`)).toEqual({
    'control-h': `${m.controlPx}px`,
    'icon-btn': `${m.iconButtonPx}px`,
    'row-h': `${m.rowPx}px`,
    gap: `${m.gapPx}px`,
    'text-base': `${m.textPx}px`,
  })
})

describe('motion tokens', () => {
  const text = css('tokens.css')
  const durations = ['motion-duration-fast', 'motion-duration-base', 'motion-duration-slow']
  it('declares durations (at most 200ms) and easings on :root', () => {
    const root = block(text, ':root')
    for (const name of durations) expect(Number.parseFloat(root[name] ?? '')).toBeLessThanOrEqual(200)
    expect(root['motion-ease-standard']).toMatch(/^cubic-bezier/)
    expect(root['motion-ease-emphasized']).toMatch(/^cubic-bezier/)
  })
  it('reduced motion makes every duration effectively instant', () => {
    const reduced = text.slice(text.indexOf('@media (prefers-reduced-motion: reduce)'))
    const root = block(reduced, ':root')
    for (const name of durations) expect(Number.parseFloat(root[name] ?? '')).toBeLessThan(1)
  })
})

describe('glass palette', () => {
  it('is the only translucent palette', () => {
    expect(PALETTE_IDS.filter(isTranslucentPalette)).toEqual(['glass'])
  })
  it('index.css loads glass.css after tokens.css', () => {
    const index = css('index.css')
    expect(index.indexOf('./glass.css')).toBeGreaterThan(index.indexOf('./tokens.css'))
  })
  it.each(THEME_MODES)('the %s glass layer makes the surfaces translucent once a backdrop is chosen', (mode) => {
    const layer = block(css('glass.css'), `:root[data-palette="glass"][data-theme="${mode}"][data-backdrop]`)
    for (const token of ['bg', 'sb', 'pn', 'el'] as const)
      expect(layer[token]).toContain(`color-mix(in srgb, ${palettes.glass[mode][token]}`)
  })
  it('reduced transparency turns every glass surface opaque and drops the blur', () => {
    const text = css('glass.css')
    const reduced = text.slice(text.indexOf('@media (prefers-reduced-transparency: reduce)'))
    expect(block(reduced, ':root[data-palette="glass"][data-backdrop]')).toMatchObject({
      'glass-chrome': '100%',
      'glass-panel': '100%',
      'glass-overlay': '100%',
      'glass-content': '100%',
      'glass-blur': 'none',
    })
  })
})
