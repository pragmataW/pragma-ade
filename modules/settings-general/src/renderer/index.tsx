import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { PAGE_ICONS, PAGE_IDS, QUICK_TOGGLE_ORDER, QUICK_TOGGLE_SLOT_ID } from '../constants'
import type { GeneralSettings } from '../contract/schemas'
import { AppearancePage } from './AppearancePage'
import { GeneralPage } from './GeneralPage'
import { ModulesPage } from './ModulesPage'
import { QuickThemeToggle } from './QuickThemeToggle'
import { ShortcutsPage } from './ShortcutsPage'

export default defineRendererModule<GeneralSettings>({
  activate(ctx) {
    const applyLanguage = (s: GeneralSettings): void => void ctx.i18n.changeLanguage(s.language)
    applyLanguage(ctx.settings.get())
    ctx.settings.subscribe(applyLanguage)
    const pages = [
      { id: PAGE_IDS.general, titleKey: 'settings-general:pages.general', component: GeneralPage },
      { id: PAGE_IDS.appearance, titleKey: 'settings-general:pages.appearance', component: AppearancePage },
      { id: PAGE_IDS.modules, titleKey: 'settings-general:pages.modules', component: ModulesPage },
      { id: PAGE_IDS.shortcuts, titleKey: 'settings-general:pages.shortcuts', component: ShortcutsPage },
    ]
    for (const p of pages)
      ctx.settingsPages.register({ ...p, order: SETTINGS_PAGE_ORDER[p.id], icon: PAGE_ICONS[p.id] })
    ctx.slots.register(ShellSlots.titlebarRight, {
      id: QUICK_TOGGLE_SLOT_ID,
      order: QUICK_TOGGLE_ORDER,
      component: QuickThemeToggle,
    })
  },
})
