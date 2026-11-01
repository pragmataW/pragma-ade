import type { ComponentType } from 'react'
import { z } from 'zod'
import { CAPABILITY_KIND, SIDES } from '../constants'
import type { Disposable } from './disposable'
import type { Logger } from './logger'
import type { SettingsSection } from './settings'

export const ProviderDescriptorSchema = z.object({
  id: z.string().min(1),
  displayNameKey: z.string().min(1),
  /** Renderer icon component lives in the provider module (`src/renderer/icon.tsx`). */
  icon: z.string().min(1),
  defaultCommand: z.string(),
  defaultArgs: z.array(z.string()),
})
export type ProviderDescriptor = z.infer<typeof ProviderDescriptorSchema>

export const defineProvider = (d: ProviderDescriptor): ProviderDescriptor => d

/** Empty on purpose: each capability type is added by the module that consumes it, via declaration merging. */
// biome-ignore lint/suspicious/noEmptyInterface: extended by declaration merging (§5.1)
export interface CapabilityMap {}
/** Renderer-side twin of `CapabilityMap` (§5.3). */
// biome-ignore lint/suspicious/noEmptyInterface: extended by declaration merging (§5.3)
export interface RendererCapabilityMap {}

export const ProviderSettingsSchema = z.record(z.string(), z.unknown())
export type ProviderSettingsValue = z.infer<typeof ProviderSettingsSchema>

/** Default export of every `providers/<id>/src/main/settings.ts`. */
export const PROVIDER_SETTINGS_SECTION: SettingsSection<ProviderSettingsValue> = {
  schema: ProviderSettingsSchema,
  defaults: {},
}

/** The provider's own settings section, keyed by the provider id. */
export interface ProviderSettings {
  get(): ProviderSettingsValue
  set(value: ProviderSettingsValue): void
  update(patch: ProviderSettingsValue): void
  onChange(cb: (value: ProviderSettingsValue) => void): Disposable
}

export interface CapabilityContext {
  log: Logger
  paths: { data: string; temp: string; resource(relPath: string): string }
  getShellEnv(): Promise<Record<string, string>>
  resolveCommand(cmd: string): Promise<string | null>
  settings: ProviderSettings
}

export type CapabilityKey = keyof CapabilityMap & string
export type RendererCapabilityKey = keyof RendererCapabilityMap & string

export type CapabilityImpl<K extends CapabilityKey> = CapabilityMap[K] & { dispose?(): void | Promise<void> }
type AnyCapabilityImpl = { dispose?(): void | Promise<void> }

export interface CapabilityRegistration {
  kind: typeof CAPABILITY_KIND
  side: typeof SIDES.main
  providerId: string
  key: string
  create: (capCtx: CapabilityContext) => AnyCapabilityImpl
}

export interface RendererCapabilityRegistration {
  kind: typeof CAPABILITY_KIND
  side: typeof SIDES.renderer
  providerId: string
  key: string
  impl: unknown
}

/** Default export of `providers/<id>/src/main/<key>.capability.ts`; accepts an impl or a factory (§10.2). */
export function defineCapability<K extends CapabilityKey>(
  providerId: string,
  key: K,
  impl: CapabilityImpl<K> | ((capCtx: CapabilityContext) => CapabilityImpl<K>),
): CapabilityRegistration {
  const create = typeof impl === 'function' ? impl : () => impl
  return {
    kind: CAPABILITY_KIND,
    side: SIDES.main,
    providerId,
    key,
    create: create as CapabilityRegistration['create'],
  }
}

/** Default export of `providers/<id>/src/renderer/<key>.capability.tsx`. */
export function defineRendererCapability<K extends RendererCapabilityKey>(
  providerId: string,
  key: K,
  impl: RendererCapabilityMap[K],
): RendererCapabilityRegistration {
  return { kind: CAPABILITY_KIND, side: SIDES.renderer, providerId, key, impl }
}

export interface ProviderIconProps {
  size?: number
  className?: string
}
export type ProviderIconComponent = ComponentType<ProviderIconProps>
