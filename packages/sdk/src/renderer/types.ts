import type { i18n as I18nInstance } from 'i18next'
import type { ComponentType } from 'react'
import type { DeepPartial } from '../common/deep-merge'
import type { Disposable } from '../common/disposable'
import type { ShortcutSpec } from '../common/shortcuts'
import type { ThemeApi } from '../common/theme'
import type { DialogsApi, NotificationsApi, ShellApi } from '../main/platform'
import type { IpcClient } from '../runtime/renderer/ipc-client'
import type { CommandRegistry } from '../runtime/shared/command-registry'
import type { RendererProvidersApi } from '../runtime/shared/provider-registry'
import type { ModuleServices } from '../runtime/shared/service-registry'

/** Right dock tab (§4.5); `icon` is a kebab-case lucide name drawn with `<Icon name>` (§10.4). */
export interface RightTab {
  id: string
  titleKey: string
  icon: string
  order: number
  component: ComponentType<{ tabId: string }>
}

/** Center area view (§4.5); `agents` (03) is the default, `board` (09) hides the right panel. */
export interface CenterView {
  id: string
  titleKey: string
  icon: string
  component: ComponentType
  order?: number
  default?: boolean
  hideRightPanel?: boolean
}

export interface SlotEntry<P = Record<string, unknown>> {
  id: string
  order: number
  component: ComponentType<P>
  match?: (props: P) => boolean
}

/** Settings page; `order` comes from `SETTINGS_PAGE_ORDER` (§10.4). */
export interface SettingsPage {
  id: string
  titleKey: string
  order: number
  component: ComponentType
  icon?: string
}

export interface RendererSettings<S> {
  get(): S
  set(value: S): Promise<S>
  update(patch: DeepPartial<S>): Promise<S>
  subscribe(cb: (value: S) => void): Disposable
  /** Read-only access to another module's section. */
  read<U>(moduleId: string): U
}

export interface RendererContext<S = unknown> {
  module: { id: string }
  panels: {
    registerRightTab(t: RightTab): Disposable
    activateRightTab(id: string): void
    setBadge(tabId: string, count: number | null): void
  }
  views: { registerCenterView(v: CenterView): Disposable; activate(id: string): void }
  slots: { register<P>(slotId: string, e: SlotEntry<P>): Disposable }
  commands: CommandRegistry
  shortcuts: { register(spec: ShortcutSpec): Disposable }
  settingsPages: { register(p: SettingsPage): Disposable }
  i18n: I18nInstance
  ipc: IpcClient
  services: ModuleServices
  settings: RendererSettings<S>
  providers: RendererProvidersApi
  dialogs: DialogsApi
  shell: ShellApi
  notifications: NotificationsApi
  nativeViews: { freeze(viewId: string): Promise<void>; unfreeze(viewId: string): Promise<void> }
  theme: ThemeApi
  testMode: boolean
}

export interface RendererModule<S = unknown> {
  activate(ctx: RendererContext<S>): void
}

/** Default export of `src/renderer/index.tsx`. */
export const defineRendererModule = <S>(m: RendererModule<S>): RendererModule<S> => m
