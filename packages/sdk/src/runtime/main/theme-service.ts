import { palettes, sharedTokens } from '@pragma/ui/tokens'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { ThemeApi, ThemeController, ThemeInput, ThemeMode, ThemeState } from '../../common/theme'
import type { PlatformAdapter } from './platform'

export type ThemeService = ThemeApi & ThemeController & { dispose(): void }

export const DEFAULT_THEME_INPUT: ThemeInput = { mode: 'system', palette: 'vscode', density: 'compact' }

const DARK: ThemeMode = 'dark'
const LIGHT: ThemeMode = 'light'

function compute(input: ThemeInput, dark: boolean): ThemeState {
  const resolved = dark ? DARK : LIGHT
  return { ...input, resolved, tokens: { ...palettes[input.palette][resolved], ...sharedTokens[resolved] } }
}

const sameState = (a: ThemeState, b: ThemeState): boolean =>
  a.mode === b.mode && a.palette === b.palette && a.density === b.density && a.resolved === b.resolved

/** Owns the resolved theme; `set` drives `nativeTheme.themeSource` through the adapter (§10.2). */
export function createThemeService(adapter: PlatformAdapter['theme'], initial = DEFAULT_THEME_INPUT): ThemeService {
  const listeners = new Set<(s: ThemeState) => void>()
  let input = initial
  adapter.setSource(input.mode)
  let state = compute(input, adapter.shouldUseDark())
  const refresh = (): void => {
    const next = compute(input, adapter.shouldUseDark())
    if (sameState(next, state)) return
    state = next
    for (const cb of [...listeners]) cb(state)
  }
  const updated: Disposable = adapter.onUpdated(refresh)
  return {
    get: () => state,
    onChange(cb) {
      listeners.add(cb)
      return toDisposable(() => listeners.delete(cb))
    },
    set(p) {
      input = { mode: p.mode, palette: p.palette, density: p.density }
      adapter.setSource(input.mode)
      refresh()
    },
    dispose: () => {
      updated.dispose()
      listeners.clear()
    },
  }
}
