import { PALETTE_COLOR_MAP } from './constants'

/** ui-notes tokens → `workbench.colorCustomizations`; tokens that are missing produce no keys. */
export function paletteToColorCustomizations(p: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [token, ids] of Object.entries(PALETTE_COLOR_MAP)) {
    const value = p[token]
    if (value === undefined) continue
    for (const id of ids) out[id] = value
  }
  return out
}
