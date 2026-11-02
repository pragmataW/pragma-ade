import { CONFIG as C, STATE_KEYS, DEFAULT_VALUES as V } from './constants'
import type { VscodeApi } from './vscodeApi'

type Default = readonly [section: string, key: string, value: unknown]

/** Defaults each version adds; index `n` is what an install at version `n` still needs (append a step to add more). */
const STEPS: readonly ((themeName: string) => readonly Default[])[] = [
  // v1: theme, no start page, telemetry/updates/experiments/tips off.
  (themeName) => [
    [C.workbench, C.colorTheme, themeName],
    [C.workbench, C.startupEditor, V.none],
    [C.telemetry, C.telemetryLevel, V.off],
    [C.update, C.mode, V.none],
    [C.workbench, C.enableExperiments, false],
    [C.workbench, C.tipsEnabled, false],
    [C.extensions, C.autoUpdate, false],
  ],
  // v2: the app's code font in the editor and the terminal.
  () => [
    [C.editor, C.fontFamily, V.monoFont],
    [C.editor, C.fontSize, V.editorFontSize],
    [C.editor, C.lineHeight, V.editorLineHeight],
    [C.terminal, C.terminalFontFamily, V.monoFont],
  ],
  // v3: Material file icons in the explorer, matching the app's trees.
  () => [[C.workbench, C.iconTheme, V.iconTheme]],
]

export const DEFAULTS_VERSION = STEPS.length

/** User defaults written once per version (then the user's): an upgrade writes only the steps it has not seen. */
export async function applyFirstRunDefaults(api: VscodeApi, themeName: string): Promise<boolean> {
  const seen = api.globalState.get<number>(STATE_KEYS.defaultsVersion) ?? 0
  if (seen >= DEFAULTS_VERSION) return false
  for (const step of STEPS.slice(seen)) {
    for (const [section, key, value] of step(themeName)) await api.updateGlobalConfig(section, key, value)
  }
  await api.globalState.update(STATE_KEYS.defaultsVersion, DEFAULTS_VERSION)
  return true
}
