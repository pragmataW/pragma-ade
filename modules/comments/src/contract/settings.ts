import { z } from '@pragma/sdk'

export const CommentsSettingsSchema = z.object({ submitAfterPaste: z.boolean().default(false) })
export type CommentsSettings = z.infer<typeof CommentsSettingsSchema>
export const COMMENTS_SETTINGS_DEFAULTS: CommentsSettings = CommentsSettingsSchema.parse({})
