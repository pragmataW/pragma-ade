import { ProjectsServiceToken } from '@pragma/module-projects/contract'
import { defineMainModule, type MainContext } from '@pragma/sdk/main'
import { SHORTCUTS } from '../constants'
import { BROWSER_COMMANDS, BrowserIpc, type BrowserSettings, BrowserSettingsSchema } from '../contract'
import { createElectronHost } from './electron-host'
import { registerBrowserIpc, runShortcut } from './ipc'
import type { PickerControl } from './picker-control'
import { getMainRuntime, setMainRuntime } from './runtime'
import { browserSettingsDefaults } from './settings'
import { BrowserTabManager } from './tab-manager'

const APP_SCOPE = 'app'

/** Placeholder until the PickerService lands (Task 8). */
const noPicker: PickerControl = { start: async () => undefined, cancel: () => undefined, dismiss: () => undefined }

function activateBrowser(ctx: MainContext<BrowserSettings>): void {
  const deps: { manager?: BrowserTabManager; picker: PickerControl } = { picker: noPicker }
  const host = createElectronHost(ctx as MainContext, (guest, action) => {
    const tabId = deps.manager?.tabIdOfGuest(guest)
    if (tabId && deps.manager)
      runShortcut(ctx as MainContext, { manager: deps.manager, picker: deps.picker }, tabId, action)
  })
  const manager = new BrowserTabManager(
    host,
    () => ctx.settings.get(),
    (s) => ctx.ipc.publish(BrowserIpc.snapshot, s),
  )
  deps.manager = manager
  registerBrowserIpc(ctx as MainContext, manager, deps.picker)
  ctx.settings.onChange(() => manager.applySettings())
  ctx.shortcuts.register({
    id: BROWSER_COMMANDS.togglePicker,
    accelerator: SHORTCUTS.togglePicker[0],
    scope: APP_SCOPE,
    command: BROWSER_COMMANDS.togglePicker,
    titleKey: 'browser:commands.togglePicker',
  })
  manager.setActiveWorktree(ctx.services.get(ProjectsServiceToken).getActiveWorktreeId())
  setMainRuntime({ manager, picker: deps.picker, host })
}

export default defineMainModule<BrowserSettings>({
  settings: { schema: BrowserSettingsSchema, defaults: browserSettingsDefaults },
  activate: activateBrowser,
  deactivate() {
    getMainRuntime().manager.dispose()
    setMainRuntime(null)
  },
})
