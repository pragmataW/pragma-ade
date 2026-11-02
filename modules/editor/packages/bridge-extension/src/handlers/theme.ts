import type { EditorSetThemeMsg } from '@pragma/module-editor/contract'
import { CONFIG, STATE_KEYS } from '../constants'
import { paletteToColorCustomizations } from '../palette'
import type { VscodeApi } from '../vscodeApi'

type Colors = Record<string, string>

/** Switches `workbench.colorTheme` when needed and replaces only the colour keys Pragma manages. */
export async function applyTheme(api: VscodeApi, m: EditorSetThemeMsg): Promise<void> {
  if (api.getGlobalConfig<string>(CONFIG.workbench, CONFIG.colorTheme) !== m.themeName)
    await api.updateGlobalConfig(CONFIG.workbench, CONFIG.colorTheme, m.themeName)
  const managed = api.globalState.get<string[]>(STATE_KEYS.managedColorKeys) ?? []
  const current = api.getGlobalConfig<Colors>(CONFIG.workbench, CONFIG.colorCustomizations) ?? {}
  const own = Object.fromEntries(Object.entries(current).filter(([k]) => !managed.includes(k)))
  const mapped = m.colors ? paletteToColorCustomizations(m.colors) : {}
  const next = { ...own, ...mapped }
  await api.globalState.update(STATE_KEYS.managedColorKeys, Object.keys(mapped))
  if (JSON.stringify(next) === JSON.stringify(current)) return
  await api.updateGlobalConfig(CONFIG.workbench, CONFIG.colorCustomizations, next)
}
