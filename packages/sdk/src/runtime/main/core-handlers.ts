import { CoreIpc, type ModuleStatus, type SetEnabledResult } from '../../common/core-ipc'
import type { Disposable } from '../../common/disposable'
import { CORE_MODULE_ID } from '../../constants'
import type { CoreSettings } from '../../main/settings'
import type { RendererCommandBridge } from './command-bridge'
import type { HostCore } from './host-core'
import { ALL_SECTIONS } from './settings-store'

export interface CoreHandlerHost {
  statuses(): ModuleStatus[]
  setModuleEnabled(id: string, enabled: boolean): SetEnabledResult
}

function registerStateHandlers(core: HostCore, host: CoreHandlerHost): void {
  const { router, settings } = core
  router.handle(CoreIpc.modulesList, () => host.statuses())
  router.handle(CoreIpc.modulesSetEnabled, ({ id, enabled }) => host.setModuleEnabled(id, enabled))
  router.handle(CoreIpc.settingsGetAll, () => settings.getAll())
  router.handle(CoreIpc.settingsSet, ({ section, value }) => settings.set(section, value))
  router.handle(CoreIpc.settingsUpdate, ({ section, patch }) => settings.update(section, patch))
  router.handle(CoreIpc.layoutGet, () => settings.get<CoreSettings>(CORE_MODULE_ID).layout)
  router.handle(CoreIpc.layoutSet, ({ key, value }) => {
    settings.update(CORE_MODULE_ID, { layout: { [key]: value } })
  })
  settings.onChange(ALL_SECTIONS, (value, section) => router.publish(CoreIpc.settingsChanged, { section, value }))
}

function registerCommandHandlers(core: HostCore, bridge: RendererCommandBridge): void {
  const { router, commands, shortcuts } = core
  const rendererShortcuts = new Map<string, Disposable>()
  router.handle(CoreIpc.commandsList, () => commands.listLocal())
  router.handle(CoreIpc.commandsExecute, ({ id, args }) => commands.execute(id, args))
  router.handle(CoreIpc.commandsAnnounce, (list) => bridge.announce(list))
  router.handle(CoreIpc.commandsRendererResult, (result) => bridge.resolve(result))
  commands.onChange(() => router.publish(CoreIpc.commandsChanged, commands.listLocal()))
  router.handle(CoreIpc.shortcutsList, () => shortcuts.list())
  router.handle(CoreIpc.shortcutsRegister, (spec) => {
    rendererShortcuts.set(spec.id, shortcuts.register(spec))
  })
  router.handle(CoreIpc.shortcutsUnregister, ({ id }) => {
    rendererShortcuts.get(id)?.dispose()
    rendererShortcuts.delete(id)
  })
  shortcuts.onChange(() => router.publish(CoreIpc.shortcutsChanged, shortcuts.list()))
}

function registerPlatformHandlers(core: HostCore): void {
  const { router, platformApis, theme, nativeViews } = core
  router.handle(CoreIpc.themeGet, () => theme.get())
  theme.onChange((state) => router.publish(CoreIpc.themeChanged, state))
  router.handle(CoreIpc.dialogsOpenFolder, (o) => platformApis.dialogs.openFolder(o))
  router.handle(CoreIpc.dialogsOpenFile, (o) => platformApis.dialogs.openFile(o))
  router.handle(CoreIpc.dialogsConfirm, (o) => platformApis.dialogs.confirm(o))
  router.handle(CoreIpc.shellOpenExternal, ({ url }) => platformApis.shell.openExternal(url))
  router.handle(CoreIpc.notificationsShow, (n) => platformApis.notifications.show(n))
  router.handle(CoreIpc.nativeViewsBounds, ({ panelTabId, bounds }) => nativeViews.setTabBounds(panelTabId, bounds))
  router.handle(CoreIpc.nativeViewsOcclusion, (o) => nativeViews.setOcclusion(o))
  router.handle(CoreIpc.nativeViewsFreeze, ({ viewId }) => nativeViews.freeze(viewId))
  router.handle(CoreIpc.nativeViewsUnfreeze, ({ viewId }) => nativeViews.unfreeze(viewId))
}

/**
 * Serves every `core.*` channel except `core.app.*` (the shell registers those) and `core.test.*` (the shell's
 * test-mode dialog stubs).
 */
export function registerCoreHandlers(core: HostCore, host: CoreHandlerHost, bridge: RendererCommandBridge): void {
  registerStateHandlers(core, host)
  registerCommandHandlers(core, bridge)
  registerPlatformHandlers(core)
}
