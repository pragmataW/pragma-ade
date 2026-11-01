import { defineMainModule } from '@pragma/sdk/main'
import { type ChatSettings, chatSettingsDefaults, chatSettingsSchema } from '../contract'

export default defineMainModule<ChatSettings>({
  settings: { schema: chatSettingsSchema, defaults: chatSettingsDefaults },
  activate() {},
})
