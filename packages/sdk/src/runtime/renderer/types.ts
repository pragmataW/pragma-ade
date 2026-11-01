import type { ModuleManifest } from '../../common/manifest'
import type { ProviderDescriptor, ProviderIconComponent, RendererCapabilityRegistration } from '../../common/providers'
import type { LocaleTree } from '../shared/i18n-resources'

/** Placeholder until the renderer module API lands (Task 16). */
export interface RendererModuleLike {
  activate(...args: never[]): unknown
}

/** One entry of the generated renderer registry (`apps/desktop/src/generated/modules.renderer.ts`). */
export interface RendererModuleRecord {
  id: string
  manifest: ModuleManifest
  renderer?: RendererModuleLike
  locales: Record<string, LocaleTree>
  provider?: {
    descriptor: ProviderDescriptor
    icon?: ProviderIconComponent
    capabilities: RendererCapabilityRegistration[]
  }
}
