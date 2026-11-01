import type { DeepPartial } from '../common/deep-merge'
import type { Disposable } from '../common/disposable'
import type { IpcContract, IpcEventContract } from '../common/ipc'
import type { Logger } from '../common/logger'
import type { SettingsSection } from '../common/settings'
import type { ShortcutSpec } from '../common/shortcuts'
import type { ThemeApi } from '../common/theme'
import type { PragmaDb } from '../db/index'
import type { EventBus } from '../runtime/main/event-bus'
import type { MainI18n } from '../runtime/main/i18n'
import type { IpcHandler } from '../runtime/main/ipc-router'
import type { CommandRegistry } from '../runtime/shared/command-registry'
import type { ProvidersApi } from '../runtime/shared/provider-registry'
import type { ModuleServices } from '../runtime/shared/service-registry'
import type { NativeViewsApi } from './native-views'
import type { DialogsApi, EnvApi, NotificationsApi, ShellApi, WindowApi } from './platform'

export interface ModuleSettingsApi<S> {
  get(): S
  set(value: S): S
  update(patch: DeepPartial<S>): S
  onChange(cb: (value: S) => void): Disposable
  /** Read-only access to another module's section. */
  read<U>(moduleId: string): U
}

export interface MainIpcApi {
  handle<I, O>(c: IpcContract<I, O>, h: IpcHandler<I, O>): Disposable
  /** Main → renderer event (§10.2). */
  publish<P>(c: IpcEventContract<P>, payload: P): void
}

export interface MainContext<S = unknown> {
  module: { id: string; version: string; paths: { root: string; data: string } }
  db: PragmaDb
  settings: ModuleSettingsApi<S>
  events: EventBus
  ipc: MainIpcApi
  services: ModuleServices
  commands: CommandRegistry
  shortcuts: { register(spec: ShortcutSpec): Disposable }
  providers: ProvidersApi
  nativeViews: NativeViewsApi
  dialogs: DialogsApi
  shell: ShellApi
  notifications: NotificationsApi
  theme: ThemeApi
  env: EnvApi
  window: WindowApi
  paths: { userData: string; logs: string; temp: string; resource(moduleId: string, relPath: string): string }
  log: Logger
  i18n: MainI18n
  testMode: boolean
}

export interface MainModule<S = unknown> {
  settings?: SettingsSection<S>
  migrations?: true
  activate(ctx: MainContext<S>): void | Promise<void>
  deactivate?(): void | Promise<void>
}

/** Default export of `src/main/index.ts`. */
export const defineMainModule = <S>(m: MainModule<S>): MainModule<S> => m

export type TestHooks = (ctx: MainContext) => void | Promise<void>

/** Default export of `src/main/test-hooks.ts`, loaded only when `PRAGMA_TEST=1` (§8). */
export const defineTestHooks = (fn: TestHooks): TestHooks => fn
