import { join } from 'node:path'
import { ProjectsServiceToken } from '@pragma/module-projects/contract'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import { ACCENT_TOKEN, PICKER_ACCENT_FALLBACK, SHORTCUTS, SHOTS_DIR } from '../constants'
import { BROWSER_COMMANDS, BrowserIpc, type BrowserSettings, BrowserSettingsSchema } from '../contract'
import { createElectronHost } from './electron-host'
import { registerBrowserIpc, runShortcut } from './ipc'
import { sweepShots } from './picker/capture'
import { PickerService } from './picker/picker-service'
import { getMainRuntime, setMainRuntime } from './runtime'
import { browserSettingsDefaults } from './settings'
import { BrowserTabManager } from './tab-manager'

const APP_SCOPE = 'app'

function activateBrowser(typed: MainContext<BrowserSettings>): void {
  const ctx = typed as MainContext
  const shotsDir = join(ctx.paths.userData, ...SHOTS_DIR)
  const deps: { manager?: BrowserTabManager; picker?: PickerService } = {}
  const host = createElectronHost(ctx, (guest, action) => {
    const { manager, picker } = deps
    const tabId = manager?.tabIdOfGuest(guest)
    if (manager && picker && tabId) runShortcut(ctx, { manager, picker }, tabId, action)
  })
  const manager = new BrowserTabManager(
    host,
    () => typed.settings.get(),
    (s) => ctx.ipc.publish(BrowserIpc.snapshot, s),
  )
  const picker = new PickerService({
    manager,
    views: host,
    settings: () => typed.settings.get(),
    shotsDir,
    page: () => ({
      accent: ctx.theme.get().tokens[ACCENT_TOKEN] ?? PICKER_ACCENT_FALLBACK,
      hint: ctx.i18n.t('browser:picker.banner'),
    }),
    emit: {
      picked: (p) => ctx.ipc.publish(BrowserIpc.picked, p),
      cancelled: (e) => ctx.ipc.publish(BrowserIpc.pickCancelled, e),
      armedChanged: (tabId) => manager.setPickerArmed(tabId),
    },
  })
  Object.assign(deps, { manager, picker })
  registerBrowserIpc(ctx, manager, picker)
  typed.settings.onChange(() => manager.applySettings())
  ctx.shortcuts.register({
    id: BROWSER_COMMANDS.togglePicker,
    accelerator: SHORTCUTS.togglePicker[0],
    scope: APP_SCOPE,
    command: BROWSER_COMMANDS.togglePicker,
    titleKey: 'browser:commands.togglePicker',
  })
  manager.setActiveWorktree(ctx.services.get(ProjectsServiceToken).getActiveWorktreeId())
  sweepShots(shotsDir, typed.settings.get().screenshotRetentionDays, Date.now()).catch((error: unknown) =>
    ctx.log.warn('sweeping old element screenshots failed', error),
  )
  setMainRuntime({ manager, picker, host })
}

export default defineMainModule<BrowserSettings>({
  settings: { schema: BrowserSettingsSchema, defaults: browserSettingsDefaults },
  activate: activateBrowser,
  deactivate() {
    getMainRuntime().manager.dispose()
    setMainRuntime(null)
  },
})
