import { z } from '@pragma/sdk'
import { FONT_MONO } from '@pragma/ui/tokens'

export const RENDERER_MODE = { auto: 'auto', dom: 'dom' } as const
export const RENDERER_MODES = [RENDERER_MODE.auto, RENDERER_MODE.dom] as const
export type RendererMode = (typeof RENDERER_MODES)[number]

export const MIN_FONT_SIZE = 8
export const MAX_FONT_SIZE = 32
export const DEFAULT_FONT_SIZE = 12
export const MIN_SCROLLBACK = 500
export const MAX_SCROLLBACK = 100_000
export const DEFAULT_SCROLLBACK = 5000
/** Wheel scroll multipliers (VS Code's terminal defaults: 1 and 5 with Alt/Ctrl held). */
export const MIN_SCROLL_SENSITIVITY = 0.1
export const MAX_SCROLL_SENSITIVITY = 10
export const DEFAULT_SCROLL_SENSITIVITY = 1
export const MIN_FAST_SCROLL_SENSITIVITY = 1
export const MAX_FAST_SCROLL_SENSITIVITY = 20
export const DEFAULT_FAST_SCROLL_SENSITIVITY = 5

/** `terminal` section of settings.json (§4.6). `shell: null` = the platform default shell. */
export const TerminalSettingsSchema = z.object({
  shell: z.string().nullable().default(null),
  fontFamily: z.string().default(FONT_MONO),
  fontSize: z.number().int().min(MIN_FONT_SIZE).max(MAX_FONT_SIZE).default(DEFAULT_FONT_SIZE),
  scrollback: z.number().int().min(MIN_SCROLLBACK).max(MAX_SCROLLBACK).default(DEFAULT_SCROLLBACK),
  scrollSensitivity: z
    .number()
    .min(MIN_SCROLL_SENSITIVITY)
    .max(MAX_SCROLL_SENSITIVITY)
    .default(DEFAULT_SCROLL_SENSITIVITY),
  fastScrollSensitivity: z
    .number()
    .min(MIN_FAST_SCROLL_SENSITIVITY)
    .max(MAX_FAST_SCROLL_SENSITIVITY)
    .default(DEFAULT_FAST_SCROLL_SENSITIVITY),
  renderer: z.enum(RENDERER_MODES).default(RENDERER_MODE.auto),
})
export type TerminalSettings = z.infer<typeof TerminalSettingsSchema>
export const TERMINAL_SETTINGS_DEFAULTS: TerminalSettings = TerminalSettingsSchema.parse({})
