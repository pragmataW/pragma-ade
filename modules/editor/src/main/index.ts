import { defineMainModule } from '@pragma/sdk/main'
import { type EditorSettings, EditorSettingsSchema, editorSettingsDefaults } from '../contract'

export default defineMainModule<EditorSettings>({
  settings: { schema: EditorSettingsSchema, defaults: editorSettingsDefaults },
  activate() {},
})
