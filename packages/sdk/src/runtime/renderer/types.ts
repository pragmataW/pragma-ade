import type { ModuleManifest } from '../../common/manifest'
import type { ProviderDescriptor, ProviderIconComponent, RendererCapabilityRegistration } from '../../common/providers'
import type { RendererModule } from '../../renderer/types'
import type { LocaleTree } from '../shared/i18n-resources'

/** One entry of the generated renderer registry (`apps/desktop/src/generated/modules.renderer.ts`). */
export interface RendererModuleRecord {
  id: string
  manifest: ModuleManifest
  renderer?: RendererModule<never>
  locales: Record<string, LocaleTree>
  provider?: {
    descriptor: ProviderDescriptor
    icon?: ProviderIconComponent
    capabilities: RendererCapabilityRegistration[]
  }
}
