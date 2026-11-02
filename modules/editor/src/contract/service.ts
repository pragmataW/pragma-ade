import { createServiceToken, z } from '@pragma/sdk'
import type { THEME_MODES } from '@pragma/ui/tokens'
import { DiffRefsSchema } from './bridge'
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
export const OpenDiffArgsSchema = z.object({
  worktreeId: z.string().min(1),
  path: z.string().min(1),
  oldPath: z.string().min(1).optional(),
  /** Absent: the uncommitted change (unstaged, else staged). Present: `old` ↔ `new` (e.g. merge-base ↔ HEAD). */
  refs: DiffRefsSchema.optional(),
  line: z.number().int().min(1).optional(),
})
export type OpenDiffArgs = z.infer<typeof OpenDiffArgsSchema>
export type OpenFileResult = { ok: true } | { ok: false; errorKey: EditorErrorI18nKey }

/** `EditorServiceToken` (§7): open a file at a line or its git diff, force a workbench theme. */
export interface EditorService {
  openFile(args: OpenFileArgs): Promise<OpenFileResult>
  /** The file's git diff in VS Code (added 2026-11-02 for Git Changes › Open in editor). */
  openDiff(args: OpenDiffArgs): Promise<OpenFileResult>
  /** `palette` is an allowed signature extension (§10.1.2). */
  setTheme(mode: ThemeMode, palette?: ThemePalette): Promise<void>
  getStatus(): EditorStatus
}

export const EditorServiceToken = createServiceToken<EditorService>('editor.service')
