import { createServiceToken, z } from '@pragma/sdk'
import type { THEME_MODES } from '@pragma/ui/tokens'
import type { EditorErrorI18nKey } from './constants'
import type { EditorStatus } from './status'

export type ThemeMode = (typeof THEME_MODES)[number]
/** Resolved ui-notes tokens from `ctx.theme` (`bg`, `sb`, `pn`, …). */
export const ThemePaletteSchema = z.record(z.string(), z.string())
export type ThemePalette = z.infer<typeof ThemePaletteSchema>

export const OpenFileArgsSchema = z.object({
  worktreeId: z.string().min(1),
  path: z.string().min(1),
  line: z.number().int().min(1).optional(),
  column: z.number().int().min(1).optional(),
})
export type OpenFileArgs = z.infer<typeof OpenFileArgsSchema>
export type OpenFileResult = { ok: true } | { ok: false; errorKey: EditorErrorI18nKey }

/** `EditorServiceToken` (§7): open a file at a line, force a workbench theme. */
export interface EditorService {
  openFile(args: OpenFileArgs): Promise<OpenFileResult>
  /** `palette` is an allowed signature extension (§10.1.2). */
  setTheme(mode: ThemeMode, palette?: ThemePalette): Promise<void>
  getStatus(): EditorStatus
}

export const EditorServiceToken = createServiceToken<EditorService>('editor.service')
