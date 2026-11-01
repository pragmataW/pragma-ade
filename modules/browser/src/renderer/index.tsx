import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import {
  RIGHT_TAB_ICON,
  RIGHT_TAB_ID,
  RIGHT_TAB_ORDER,
  SETTINGS_PAGE_ICON,
  STATUSBAR_ENTRY_ID,
  STATUSBAR_ORDER,
} from '../constants'
import type { BrowserSettings } from '../contract'
import { BrowserPanel } from './BrowserPanel'
import { BrowserSettingsPage } from './BrowserSettingsPage'
import { DevUrlStatus } from './DevUrlStatus'
import { setRuntime } from './runtime'
import { createBrowserStore } from './store'

export default defineRendererModule<BrowserSettings>({
  activate(ctx) {
    setRuntime({ ctx, store: createBrowserStore(ctx.ipc) })
    ctx.panels.registerRightTab({
      id: RIGHT_TAB_ID,
      titleKey: 'browser:tab.title',
      icon: RIGHT_TAB_ICON,
      order: RIGHT_TAB_ORDER,
      component: BrowserPanel,
    })
    ctx.slots.register(ShellSlots.statusbarRight, {
      id: STATUSBAR_ENTRY_ID,
      order: STATUSBAR_ORDER,
      component: DevUrlStatus,
    })
    ctx.settingsPages.register({
      id: RIGHT_TAB_ID,
      titleKey: 'browser:settings.title',
      order: SETTINGS_PAGE_ORDER.browser,
      icon: SETTINGS_PAGE_ICON,
      component: BrowserSettingsPage,
    })
  },
})
