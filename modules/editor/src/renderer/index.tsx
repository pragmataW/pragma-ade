import { ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import {
  EDITOR_MODULE_ID,
  EDITOR_SETTINGS_ICON,
  EDITOR_SETTINGS_ORDER,
  EDITOR_STATUSBAR_ENTRY_ID,
  EDITOR_STATUSBAR_ORDER,
  EditorIpcEvents,
  type EditorSettings,
  FILES_TAB_ICON,
  FILES_TAB_ID,
  FILES_TAB_ORDER,
} from '../contract'
import { EditorSettingsPage } from './EditorSettingsPage'
import { FilesTab } from './FilesTab'
import { LanguageStatusItem } from './LanguageStatusItem'
import { setEditorRendererRuntime } from './runtime'

export default defineRendererModule<EditorSettings>({
  activate(ctx) {
    setEditorRendererRuntime({ ctx })
    ctx.panels.registerRightTab({
      id: FILES_TAB_ID,
      titleKey: 'editor:tab.files',
      icon: FILES_TAB_ICON,
      order: FILES_TAB_ORDER,
      component: FilesTab,
    })
    ctx.settingsPages.register({
      id: EDITOR_MODULE_ID,
      titleKey: 'editor:settings.title',
      order: EDITOR_SETTINGS_ORDER,
      icon: EDITOR_SETTINGS_ICON,
      component: EditorSettingsPage,
    })
    ctx.slots.register(ShellSlots.statusbarRight, {
      id: EDITOR_STATUSBAR_ENTRY_ID,
      order: EDITOR_STATUSBAR_ORDER,
      component: LanguageStatusItem,
    })
    ctx.ipc.subscribe(EditorIpcEvents.revealRequested, () => ctx.panels.activateRightTab(FILES_TAB_ID))
  },
})
