import { defineRendererModule } from '@pragma/sdk/renderer'
import {
  COMMANDS,
  EXAMPLE_SETTINGS_ORDER,
  SETTINGS_PAGE_ICON,
  SETTINGS_PAGE_ID,
  TAB_ICON,
  TAB_ID,
  TAB_ORDER,
} from '../constants'
import { ExampleIpc, type ExampleSettings } from '../contract'
import { formatGreeting } from '../lib/greeting'
import { ExampleSettingsPage } from './ExampleSettingsPage'
import { ExampleTab } from './ExampleTab'

export default defineRendererModule<ExampleSettings>({
  activate(ctx) {
    ctx.panels.registerRightTab({
      id: TAB_ID,
      titleKey: 'example:tab.title',
      icon: TAB_ICON,
      order: TAB_ORDER,
      component: ExampleTab,
    })
    ctx.ipc.subscribe(ExampleIpc.itemAdded, ({ total }) => ctx.panels.setBadge(TAB_ID, total))
    ctx.settingsPages.register({
      id: SETTINGS_PAGE_ID,
      titleKey: 'example:settings.title',
      order: EXAMPLE_SETTINGS_ORDER,
      icon: SETTINGS_PAGE_ICON,
      component: ExampleSettingsPage,
    })
    ctx.commands.register(
      COMMANDS.sayHello,
      () => {
        const name = formatGreeting(ctx.settings.get().name)
        ctx.notifications.show({
          titleKey: 'example:notifications.helloTitle',
          bodyKey: 'example:greeting',
          params: { name },
        })
        ctx.panels.activateRightTab(TAB_ID)
      },
      { titleKey: 'example:commands.sayHello', palette: true },
    )
  },
})
