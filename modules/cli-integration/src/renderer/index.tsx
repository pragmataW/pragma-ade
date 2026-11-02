import { defineRendererModule } from '@pragma/sdk/renderer'
import { SETTINGS_PAGE_ICON, SETTINGS_PAGE_ID, SETTINGS_PAGE_ORDER } from '../constants'
import { CliSettingsPage } from './CliSettingsPage'
import { setCliRuntime } from './runtime'

export default defineRendererModule({
  activate(ctx) {
    setCliRuntime({ ctx })
    ctx.settingsPages.register({
      id: SETTINGS_PAGE_ID,
      titleKey: 'cli-integration:settings.title',
      order: SETTINGS_PAGE_ORDER,
      icon: SETTINGS_PAGE_ICON,
      component: CliSettingsPage,
    })
  },
})
