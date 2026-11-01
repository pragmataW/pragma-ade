import { z } from '@pragma/sdk'
import {
  DEFAULT_THEME_MAP,
  GRACE_SECONDS_DEFAULT,
  GRACE_SECONDS_MAX,
  GRACE_SECONDS_MIN,
  MAX_OPEN_VIEWS_DEFAULT,
  MAX_OPEN_VIEWS_MAX,
  MAX_OPEN_VIEWS_MIN,
} from './constants'

/** `settings.json` → `editor`. Global shortcuts are the SDK's (`ctx.shortcuts`), not an editor setting. */
export const EditorSettingsSchema = z.object({
  maxOpenViews: z.number().int().min(MAX_OPEN_VIEWS_MIN).max(MAX_OPEN_VIEWS_MAX),
  themeMap: z.object({ dark: z.string().min(1), light: z.string().min(1) }),
  syncPalette: z.boolean(),
  serveWebviewsLocally: z.boolean(),
  reconnectionGraceSeconds: z.number().int().min(GRACE_SECONDS_MIN).max(GRACE_SECONDS_MAX),
})
export type EditorSettings = z.infer<typeof EditorSettingsSchema>

export const editorSettingsDefaults: EditorSettings = {
  maxOpenViews: MAX_OPEN_VIEWS_DEFAULT,
  themeMap: { ...DEFAULT_THEME_MAP },
  syncPalette: true,
  serveWebviewsLocally: true,
  reconnectionGraceSeconds: GRACE_SECONDS_DEFAULT,
}
