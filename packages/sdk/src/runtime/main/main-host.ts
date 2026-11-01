import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { ModuleStatus, SetEnabledResult } from '../../common/core-ipc'
import type { Logger } from '../../common/logger'
import { type CapabilityContext, PROVIDER_SETTINGS_SECTION, type ProviderSettingsValue } from '../../common/providers'
import { ThemeControllerToken } from '../../common/theme'
import { APP_DIR_NAMES, CORE_MODULE_ID } from '../../constants'
import { CORE_SETTINGS_DEFAULTS, type CoreSettings, CoreSettingsSchema } from '../../main/settings'
import { createCommandRegistry } from '../shared/command-registry'
import { buildI18nResources, type LocaleTree } from '../shared/i18n-resources'
import type { IpcTransport } from '../shared/memory-transport'
import { ProviderRegistry } from '../shared/provider-registry'
import { createServiceRegistry } from '../shared/service-registry'
import { createShortcutRegistry } from '../shared/shortcut-registry'
import { type ActiveModule, activateAll } from './activation'
import { createRendererCommandBridge } from './command-bridge'
import { registerCoreHandlers } from './core-handlers'
import { openDatabase } from './database'
import { createEventBus } from './event-bus'
import type { HostCore } from './host-core'
import { createMainI18n } from './i18n'
import { IpcRouter } from './ipc-router'
import { createLogger } from './logger'
import { hostPaths } from './module-context'
import { resolveModuleGraph } from './module-graph'
import { NativeViewHost, type ViewContainer } from './native-view-host'
import type { PlatformAdapter } from './platform'
import { createPlatformApis } from './platform-apis'
import { createResourcePaths } from './resource-paths'
import { SettingsStore } from './settings-store'
import { createThemeService } from './theme-service'
import type { ModuleRecord } from './types'

export class CoreModuleError extends Error {}
export class UnknownModuleRecordError extends Error {}

export interface MainHostOptions {
  records: readonly ModuleRecord[]
  coreLocales: Record<string, LocaleTree>
  userDataDir: string
  transport: IpcTransport
  viewContainer: ViewContainer
  platform: PlatformAdapter
  testMode: boolean
  appVersion: string
  log?: Logger
}

export interface MainHost extends Pick<HostCore, 'router' | 'settings' | 'commands' | 'shortcuts' | 'i18n' | 'theme'> {
  statuses(): ModuleStatus[]
  db: HostCore['database']['db']
  sqlite: HostCore['database']['sqlite']
  providers: ReturnType<ProviderRegistry['api']>
  nativeViews: HostCore['nativeViews']
  platformApis: HostCore['platformApis']
  log: Logger
  appVersion: string
  setModuleEnabled(id: string, enabled: boolean): SetEnabledResult
  dispose(): Promise<void>
}

const coreSection = { schema: CoreSettingsSchema, defaults: CORE_SETTINGS_DEFAULTS }

function providerCapCtx(core: HostCore, id: string): CapabilityContext {
  const paths = hostPaths(core)
  return {
    log: core.log.child(id),
    paths: {
      data: join(core.userDataDir, APP_DIR_NAMES.providers, id),
      temp: join(paths.temp, id),
      resource: (rel) => core.resources.resource(id, rel),
    },
    getShellEnv: core.platformApis.env.getShellEnv,
    resolveCommand: core.platformApis.env.resolveCommand,
    settings: {
      get: () => core.settings.get<ProviderSettingsValue>(id),
      set: (v) => void core.settings.set(id, v),
      update: (p) => void core.settings.update(id, p),
      onChange: (cb) => core.settings.onChange(id, (v) => cb(v as ProviderSettingsValue)),
    },
  }
}

function createCore(opts: MainHostOptions): HostCore {
  mkdirSync(opts.userDataDir, { recursive: true })
  const log = opts.log ?? createLogger({ file: join(opts.userDataDir, APP_DIR_NAMES.logs, APP_DIR_NAMES.mainLog) })
  const settings = new SettingsStore(join(opts.userDataDir, APP_DIR_NAMES.settings), log)
  settings.registerSection(CORE_MODULE_ID, coreSection)
  const router = new IpcRouter(opts.transport, log)
  const i18n = createMainI18n({
    resources: buildI18nResources(
      opts.records.map((r) => ({ id: r.manifest.id, locales: r.locales })),
      opts.coreLocales,
    ),
    testMode: opts.testMode,
    log,
  })
  const commands = createCommandRegistry({ log })
  const resources = createResourcePaths({
    isPackaged: opts.platform.isPackaged,
    resourcesPath: opts.platform.resourcesPath,
    modules: new Map(opts.records.map((r) => [r.manifest.id, { dir: r.dir, extraResources: r.extraResources }])),
  })
  const core: HostCore = {
    log,
    router,
    settings,
    database: openDatabase(join(opts.userDataDir, APP_DIR_NAMES.database)),
    commands,
    shortcuts: createShortcutRegistry(opts.platform.platform, log),
    theme: createThemeService(opts.platform.theme),
    nativeViews: new NativeViewHost(opts.viewContainer, (c, p) => router.publish(c, p)),
    platform: opts.platform,
    platformApis: createPlatformApis(opts.platform, i18n, commands, log),
    services: createServiceRegistry(),
    events: createEventBus(log),
    i18n,
    providers: undefined as unknown as ProviderRegistry,
    resources,
    userDataDir: opts.userDataDir,
    testMode: opts.testMode,
  }
  core.providers = new ProviderRegistry((id) => providerCapCtx(core, id), log)
  core.services.scope(CORE_MODULE_ID, { required: [], optional: [] }).provide(ThemeControllerToken, core.theme)
  return core
}

function registerProviders(core: HostCore, records: readonly ModuleRecord[], enabled: ReadonlySet<string>): void {
  for (const record of records) {
    const id = record.manifest.id
    if (!record.provider || !enabled.has(id)) continue
    core.settings.registerSection(id, record.provider.settings ?? PROVIDER_SETTINGS_SECTION)
    core.providers.add(id, record.provider.descriptor, record.provider.capabilities)
  }
}

function affectedBy(records: readonly ModuleRecord[], before: ReadonlySet<string>, disabled: string[], id: string) {
  const after = new Set(
    resolveModuleGraph(
      records.map((r) => r.manifest),
      { disabled },
    ).order,
  )
  return records.map((r) => r.manifest.id).filter((m) => m !== id && before.has(m) !== after.has(m))
}

/** Boots every module in dependency order with full isolation, then serves the core IPC channels. */
export async function createMainHost(opts: MainHostOptions): Promise<MainHost> {
  const core = createCore(opts)
  const records = new Map(opts.records.map((r) => [r.manifest.id, r]))
  const coreSettings = (): CoreSettings => core.settings.get<CoreSettings>(CORE_MODULE_ID)
  const manifests = opts.records.map((r) => r.manifest)
  const graph = resolveModuleGraph(manifests, { disabled: coreSettings().modules.disabled })
  registerProviders(core, opts.records, new Set(graph.order))
  const { statuses, active } = await activateAll(core, records, graph)
  const statusList = (): ModuleStatus[] => [...statuses.values()].sort((a, b) => a.id.localeCompare(b.id))

  const setModuleEnabled = (id: string, enabled: boolean): SetEnabledResult => {
    const record = records.get(id)
    if (!record) throw new UnknownModuleRecordError(`unknown module ${id}`)
    if (record.manifest.core) throw new CoreModuleError(`core module ${id} cannot be disabled`)
    const current = coreSettings().modules.disabled.filter((m) => m !== id)
    const disabled = enabled ? current : [...current, id].sort()
    const enabledNow = new Set(resolveModuleGraph(manifests, { disabled: coreSettings().modules.disabled }).order)
    core.settings.update(CORE_MODULE_ID, { modules: { disabled } })
    return { restartRequired: true, affected: affectedBy(opts.records, enabledNow, disabled, id) }
  }

  const bridge = createRendererCommandBridge(core.router, core.log)
  core.commands.setRemote(bridge)
  registerCoreHandlers(core, { statuses: statusList, setModuleEnabled }, bridge)

  return {
    statuses: statusList,
    router: core.router,
    settings: core.settings,
    db: core.database.db,
    sqlite: core.database.sqlite,
    commands: core.commands,
    shortcuts: core.shortcuts,
    providers: core.providers.api(),
    i18n: core.i18n,
    nativeViews: core.nativeViews,
    theme: core.theme,
    platformApis: core.platformApis,
    log: core.log,
    appVersion: opts.appVersion,
    setModuleEnabled,
    dispose: () => disposeHost(core, active, bridge),
  }
}

async function disposeHost(core: HostCore, active: ActiveModule[], bridge: { dispose(): void }): Promise<void> {
  for (const mod of [...active].reverse()) {
    try {
      await mod.main?.deactivate?.()
    } catch (error) {
      core.log.error(`module ${mod.id} failed to deactivate`, error)
    }
    for (const d of mod.disposables.reverse()) d.dispose()
  }
  bridge.dispose()
  await core.providers.disposeAll()
  core.theme.dispose()
  core.database.close()
}
