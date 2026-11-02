import type { EditorSetThemeMsg } from '@pragma/module-editor/contract'
import { CONFIG, STATE_KEYS, THEME_APPLY, THEME_SCOPE } from '../constants'
import { paletteToColorCustomizations } from '../palette'
import type { VscodeApi } from '../vscodeApi'

type Colors = Record<string, string>
/** `workbench.colorCustomizations`: colour ids at the top level and `[<theme>]` blocks. */
export type Customizations = Record<string, unknown>
/** Scope (`''` top level, `[<theme>]` a theme block) → the colour ids Pragma wrote there. */
export type ManagedColors = Record<string, string[]>

const scopeOf = (themeName: string): string => `${THEME_SCOPE.open}${themeName}${THEME_SCOPE.close}`
const isBlock = (v: unknown): v is Colors => typeof v === 'object' && v !== null && !Array.isArray(v)
const omit = <V>(o: Record<string, V>, keys: readonly string[]): Record<string, V> =>
  Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)))
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** The user's own customizations: everything Pragma wrote before is taken out (blocks left empty go too). */
function withoutManaged(current: Customizations, managed: ManagedColors): Customizations {
  const out = omit(current, managed[THEME_SCOPE.top] ?? [])
  for (const [scope, ids] of Object.entries(managed)) {
    const block = out[scope]
    if (scope === THEME_SCOPE.top || !isBlock(block)) continue
    out[scope] = omit(block, ids)
  }
  return Object.fromEntries(Object.entries(out).filter(([, v]) => !isBlock(v) || Object.keys(v).length > 0))
}

/**
 * The next `colorCustomizations`: each theme's palette in its own `[<theme>]` block, so the active colour theme
 * always picks the matching palette (top-level keys would paint one mode's palette over the other mode's theme).
 */
export function nextCustomizations(
  current: Customizations,
  managed: ManagedColors,
  m: EditorSetThemeMsg,
): { next: Customizations; managed: ManagedColors } {
  const next = withoutManaged(current, managed)
  const written: ManagedColors = {}
  for (const [themeName, tokens] of Object.entries(m.colorsByTheme ?? {})) {
    const mapped = paletteToColorCustomizations(tokens)
    const ids = Object.keys(mapped)
    if (ids.length === 0) continue
    const scope = scopeOf(themeName)
    const own = next[scope]
    next[scope] = { ...(isBlock(own) ? own : {}), ...mapped }
    written[scope] = ids
  }
  return { next, managed: written }
}

function readManaged(api: VscodeApi): ManagedColors {
  const scoped = api.globalState.get<ManagedColors>(STATE_KEYS.managedColors) ?? {}
  const legacy = api.globalState.get<string[]>(STATE_KEYS.managedColorKeys) ?? []
  return { ...scoped, [THEME_SCOPE.top]: [...(scoped[THEME_SCOPE.top] ?? []), ...legacy] }
}

const readCustomizations = (api: VscodeApi): Customizations =>
  api.getGlobalConfig<Customizations>(CONFIG.workbench, CONFIG.colorCustomizations) ?? {}

/** Colours first (the blocks fit either theme), then the theme: every intermediate state is consistent. */
async function writeOnce(api: VscodeApi, m: EditorSetThemeMsg): Promise<void> {
  const current = readCustomizations(api)
  const { next, managed } = nextCustomizations(current, readManaged(api), m)
  if (!same(next, current)) await api.updateGlobalConfig(CONFIG.workbench, CONFIG.colorCustomizations, next)
  await api.globalState.update(STATE_KEYS.managedColors, managed)
  if (api.globalState.get(STATE_KEYS.managedColorKeys) !== undefined)
    await api.globalState.update(STATE_KEYS.managedColorKeys, undefined)
  if (api.getGlobalConfig<string>(CONFIG.workbench, CONFIG.colorTheme) !== m.themeName)
    await api.updateGlobalConfig(CONFIG.workbench, CONFIG.colorTheme, m.themeName)
}

function isApplied(api: VscodeApi, m: EditorSetThemeMsg): boolean {
  if (api.getGlobalConfig<string>(CONFIG.workbench, CONFIG.colorTheme) !== m.themeName) return false
  const current = readCustomizations(api)
  return same(nextCustomizations(current, readManaged(api), m).next, current)
}

/**
 * Writes the theme and reads it back. Every workbench on the server writes the same user settings, so a write can
 * fail (the file changed underneath) or be overwritten by another window's older value: it is retried until it holds.
 * Callers serialize applies (`LatestQueue`): two overlapping read-modify-writes mix two themes.
 */
export async function applyTheme(api: VscodeApi, m: EditorSetThemeMsg): Promise<void> {
  let failure: unknown
  for (let attempt = 0; attempt < THEME_APPLY.attempts; attempt++) {
    if (attempt > 0) await delay(THEME_APPLY.retryDelayMs)
    failure = undefined
    try {
      await writeOnce(api, m)
    } catch (error) {
      failure = error
    }
    if (failure === undefined && isApplied(api, m)) return
  }
  if (failure !== undefined) throw failure
}
