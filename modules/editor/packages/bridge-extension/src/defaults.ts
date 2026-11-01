import { CONFIG as C, STATE_KEYS, DEFAULT_VALUES as V } from './constants'
import type { VscodeApi } from './vscodeApi'

export const DEFAULTS_VERSION = 1

/** User defaults written once (then the user's): theme, no start page, telemetry/updates/experiments/tips off. */
export async function applyFirstRunDefaults(api: VscodeApi, themeName: string): Promise<boolean> {
  if ((api.globalState.get<number>(STATE_KEYS.defaultsVersion) ?? 0) >= DEFAULTS_VERSION) return false
  const defaults: [string, string, unknown][] = [
    [C.workbench, C.colorTheme, themeName],
    [C.workbench, C.startupEditor, V.none],
    [C.telemetry, C.telemetryLevel, V.off],
    [C.update, C.mode, V.none],
    [C.workbench, C.enableExperiments, false],
    [C.workbench, C.tipsEnabled, false],
    [C.extensions, C.autoUpdate, false],
  ]
  for (const [section, key, value] of defaults) await api.updateGlobalConfig(section, key, value)
  await api.globalState.update(STATE_KEYS.defaultsVersion, DEFAULTS_VERSION)
  return true
}
