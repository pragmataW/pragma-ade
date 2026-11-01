import { z } from 'zod'
import type { Disposable } from './disposable'
import { createServiceToken } from './services'

// TODO(Task 15): move PALETTE_IDS, THEME_MODES and DENSITIES into @pragma/ui/tokens and re-export them here.
export const PALETTE_IDS = ['vscode', 'dark-brown', 'amber', 'indigo'] as const
export const THEME_MODES = ['light', 'dark'] as const
export const DENSITIES = ['compact', 'comfortable'] as const
export type PaletteId = (typeof PALETTE_IDS)[number]
export type ThemeMode = (typeof THEME_MODES)[number]
export type Density = (typeof DENSITIES)[number]
export type TokenName = string

export const APPEARANCE_MODES = ['system', ...THEME_MODES] as const
export type AppearanceMode = (typeof APPEARANCE_MODES)[number]

export const ThemeStateSchema = z.object({
  mode: z.enum(APPEARANCE_MODES),
  palette: z.enum(PALETTE_IDS),
  density: z.enum(DENSITIES),
  resolved: z.enum(THEME_MODES),
  tokens: z.record(z.string(), z.string()),
})
export type ThemeState = z.infer<typeof ThemeStateSchema>

export const ThemeInputSchema = ThemeStateSchema.pick({ mode: true, palette: true, density: true })
export type ThemeInput = z.infer<typeof ThemeInputSchema>

/** Read-only theme access (`ctx.theme`); consumers use `resolved`, never `mode` (§10.4). */
export interface ThemeApi {
  get(): ThemeState
  onChange(cb: (s: ThemeState) => void): Disposable
}

/** Write access, provided by the shell and used by settings-general. */
export interface ThemeController {
  set(p: ThemeInput): void
}

export const ThemeControllerToken = createServiceToken<ThemeController>('core.theme')
