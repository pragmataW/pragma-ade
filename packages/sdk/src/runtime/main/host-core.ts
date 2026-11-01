import type { Logger } from '../../common/logger'
import type { CommandRegistry } from '../shared/command-registry'
import type { ProviderRegistry } from '../shared/provider-registry'
import type { ServiceRegistry } from '../shared/service-registry'
import type { ShortcutRegistry } from '../shared/shortcut-registry'
import type { OpenedDatabase } from './database'
import type { EventBus } from './event-bus'
import type { MainI18n } from './i18n'
import type { IpcRouter } from './ipc-router'
import type { NativeViewHost } from './native-view-host'
import type { PlatformAdapter } from './platform'
import type { PlatformApis } from './platform-apis'
import type { ResourcePaths } from './resource-paths'
import type { SettingsStore } from './settings-store'
import type { ThemeService } from './theme-service'

/** The shared host services every module context is built from. */
export interface HostCore {
  log: Logger
  router: IpcRouter
  settings: SettingsStore
  database: OpenedDatabase
  commands: CommandRegistry
  shortcuts: ShortcutRegistry
  theme: ThemeService
  nativeViews: NativeViewHost
  platform: PlatformAdapter
  platformApis: PlatformApis
  services: ServiceRegistry
  events: EventBus
  i18n: MainI18n
  providers: ProviderRegistry
  resources: ResourcePaths
  userDataDir: string
  testMode: boolean
}
