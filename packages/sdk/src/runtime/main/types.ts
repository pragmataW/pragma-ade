import type { ExtraResource, ModuleManifest } from '../../common/manifest'
import type { CapabilityRegistration, ProviderDescriptor } from '../../common/providers'
import type { SettingsSection } from '../../common/settings'
import type { MainModule, TestHooks } from '../../main/types'
import type { LocaleTree } from '../shared/i18n-resources'

/** One entry of the generated main registry (`apps/desktop/src/generated/modules.main.ts`). */
export interface ModuleRecord {
  manifest: ModuleManifest
  packageName: string
  version: string
  dir: string
  /** `from` absolute, `to` module-relative; feeds `ctx.paths.resource` (§10.2). */
  extraResources: ExtraResource[]
  main?: MainModule<unknown>
  migrations: { name: string; sql: string }[]
  locales: Record<string, LocaleTree>
  testHooks?: () => Promise<{ default: TestHooks }>
  provider?: {
    descriptor: ProviderDescriptor
    capabilities: CapabilityRegistration[]
    settings?: SettingsSection<unknown>
  }
}
