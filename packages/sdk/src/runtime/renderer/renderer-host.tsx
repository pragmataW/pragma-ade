import type { i18n as I18nInstance } from 'i18next'
import type { ComponentType } from 'react'
import { type AppInfo, CoreIpc, MODULE_STATE, type ModuleStatus } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { Logger } from '../../common/logger'
import type { KeyInput, ShortcutSpec } from '../../common/shortcuts'
import type { ThemeApi } from '../../common/theme'
import { ModuleContext } from '../../renderer/context'
import type { RendererContext } from '../../renderer/types'
import type { CommandRegistry } from '../shared/command-registry'
import { buildI18nResources, type LocaleTree } from '../shared/i18n-resources'
import { consoleSink, loggerFromSinks } from '../shared/log-sinks'
import type { PragmaBridge } from '../shared/memory-transport'
import { RendererProviderRegistry, type RendererProvidersApi } from '../shared/provider-registry'
import { createServiceRegistry, type ServiceRegistry } from '../shared/service-registry'
import { createShortcutRegistry, type ShortcutFocus, type ShortcutRegistry } from '../shared/shortcut-registry'
import { createRendererCommands } from './command-bridge'
import { createRendererI18n } from './i18n'
import { createIpcClient, type IpcClient } from './ipc-client'
import { createLayoutStore, type LayoutStore } from './layout-store'
import { createRendererPlatform, type RendererPlatform } from './platform-client'
import { createRegistries, type Registries } from './registries'
import { createSettingsClient, type SettingsClient } from './settings-client'
import { createThemeClient } from './theme-client'
import type { RendererModuleRecord } from './types'

export interface RendererShortcuts {
  list(): ShortcutSpec[]
  match(input: KeyInput, focus: ShortcutFocus): ShortcutSpec | undefined
  onChange(cb: () => void): Disposable
}

export interface RendererHost {
  registries: Registries
  commands: CommandRegistry
  shortcuts: RendererShortcuts
  i18n: I18nInstance
  appInfo: AppInfo
  statuses: ModuleStatus[]
  layout: LayoutStore
  theme: ThemeApi
  settings: SettingsClient
  providers: RendererProvidersApi
  services: ServiceRegistry
  platform: RendererPlatform
  ipc: IpcClient
  log: Logger
  contextFor(id: string): RendererContext | undefined
  dispose(): void
}

function withModule<P extends object>(ctx: RendererContext, Component: ComponentType<P>): ComponentType<P> {
  function InModule(props: P) {
    return (
      <ModuleContext.Provider value={ctx}>
        <Component {...props} />
      </ModuleContext.Provider>
    )
  }
  InModule.displayName = `${ctx.module.id}(${Component.displayName ?? Component.name})`
  return InModule
}

/** Mirrors main's shortcut list into a local registry for renderer-side matching. */
function shortcutMirror(ipc: IpcClient, initial: ShortcutSpec[], platform: string, log: Logger) {
  const listeners = new Set<() => void>()
  let registry: ShortcutRegistry = createShortcutRegistry(platform, log)
  const load = (specs: ShortcutSpec[]): void => {
    registry = createShortcutRegistry(platform, log)
    for (const spec of specs) registry.register(spec)
    for (const cb of [...listeners]) cb()
  }
  load(initial)
  const sub = ipc.subscribe(CoreIpc.shortcutsChanged, load)
  const api: RendererShortcuts = {
    list: () => registry.list(),
    match: (input, focus) => registry.match(input, focus),
    onChange(cb) {
      listeners.add(cb)
      return toDisposable(() => listeners.delete(cb))
    },
  }
  return { api, dispose: () => sub.dispose() }
}

async function fetchBoot(ipc: IpcClient) {
  const none = undefined
  const [appInfo, statuses, settings, layout, commands, shortcuts, theme] = await Promise.all([
    ipc.invoke(CoreIpc.appInfo, none),
    ipc.invoke(CoreIpc.modulesList, none),
    ipc.invoke(CoreIpc.settingsGetAll, none),
    ipc.invoke(CoreIpc.layoutGet, none),
    ipc.invoke(CoreIpc.commandsList, none),
    ipc.invoke(CoreIpc.shortcutsList, none),
    ipc.invoke(CoreIpc.themeGet, none),
  ])
  return { appInfo, statuses, settings, layout, commands, shortcuts, theme }
}

/** Boots the renderer side: fetches core state, activates the modules active in main (in main's order). */
export async function createRendererHost(opts: {
  records: readonly RendererModuleRecord[]
  coreLocales: Record<string, LocaleTree>
  bridge: PragmaBridge
  log?: Logger
}): Promise<RendererHost> {
  const log = opts.log ?? loggerFromSinks([consoleSink])
  const ipc = createIpcClient(opts.bridge, log)
  const boot = await fetchBoot(ipc)
  const i18n = createRendererI18n({
    resources: buildI18nResources(
      opts.records.map((r) => ({ id: r.id, locales: r.locales })),
      opts.coreLocales,
    ),
    testMode: boot.appInfo.testMode,
    onMissing: (m) => log.warn(m),
  })
  const registries = createRegistries()
  const bridgeCommands = createRendererCommands(ipc, boot.commands, log)
  const shortcuts = shortcutMirror(ipc, boot.shortcuts, boot.appInfo.platform, log)
  const theme = createThemeClient(boot.theme, ipc)
  const settings = createSettingsClient(boot.settings, ipc)
  const providerRegistry = new RendererProviderRegistry(log)
  const active = new Set(boot.statuses.filter((s) => s.state === MODULE_STATE.active).map((s) => s.id))
  const records = new Map(opts.records.map((r) => [r.id, r]))
  for (const r of opts.records)
    if (r.provider && active.has(r.id))
      providerRegistry.add(r.id, r.provider.descriptor, r.provider.icon, r.provider.capabilities)
  const services = createServiceRegistry()
  const platform = createRendererPlatform(ipc)
  const contexts = new Map<string, RendererContext>()

  const buildContext = (record: RendererModuleRecord): RendererContext => {
    const id = record.id
    const ctx: RendererContext = {
      module: { id },
      panels: {
        registerRightTab: (t) => registries.registerRightTab({ ...t, component: withModule(ctx, t.component) }),
        activateRightTab: registries.activateRightTab,
        setBadge: registries.setBadge,
      },
      views: {
        registerCenterView: (v) => registries.registerCenterView({ ...v, component: withModule(ctx, v.component) }),
        activate: registries.activateView,
      },
      slots: {
        register: (slotId, e) =>
          registries.registerSlot(slotId, {
            ...e,
            component: withModule(ctx, e.component as ComponentType<object>) as typeof e.component,
          }),
      },
      commands: bridgeCommands.commands,
      shortcuts: {
        register(spec) {
          void ipc.invoke(CoreIpc.shortcutsRegister, spec).catch((e) => log.error(`shortcut ${spec.id}`, e))
          return toDisposable(() => void ipc.invoke(CoreIpc.shortcutsUnregister, { id: spec.id }))
        },
      },
      settingsPages: {
        register: (p) => registries.registerSettingsPage({ ...p, component: withModule(ctx, p.component) }),
      },
      i18n,
      ipc,
      services: services.scope(id, {
        required: record.manifest.dependsOn,
        optional: record.manifest.optionalDependsOn,
      }),
      settings: settings.forSection(id),
      providers: providerRegistry.api(),
      ...platform,
      theme,
      testMode: boot.appInfo.testMode,
    }
    return ctx
  }

  for (const status of boot.statuses) {
    const record = records.get(status.id)
    if (status.state !== MODULE_STATE.active || !record) continue
    const ctx = buildContext(record)
    contexts.set(record.id, ctx)
    try {
      record.renderer?.activate(ctx as RendererContext<never>)
    } catch (error) {
      log.error(`renderer module ${record.id} failed to activate`, error)
    }
  }

  return {
    registries,
    commands: bridgeCommands.commands,
    shortcuts: shortcuts.api,
    i18n,
    appInfo: boot.appInfo,
    statuses: boot.statuses,
    layout: createLayoutStore(boot.layout, ipc),
    theme,
    settings,
    providers: providerRegistry.api(),
    services,
    platform,
    ipc,
    log,
    contextFor: (id) => contexts.get(id),
    dispose() {
      bridgeCommands.dispose()
      shortcuts.dispose()
      theme.dispose()
      settings.dispose()
    },
  }
}
