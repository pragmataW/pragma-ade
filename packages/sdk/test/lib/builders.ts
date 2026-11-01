import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestModuleHost, type FakePlatform } from '@pragma/test-support'
import { afterAll } from 'vitest'
import type { ModuleManifest } from '../../src/common/manifest'
import { type CapabilityRegistration, defineProvider } from '../../src/common/providers'
import type { SettingsSection } from '../../src/common/settings'
import type { MainModule, TestHooks } from '../../src/main/types'
import type { ModuleRecord } from '../../src/runtime/main/types'
import type { LocaleTree } from '../../src/runtime/shared/i18n-resources'

export function manifest(id: string, partial: Partial<ModuleManifest> = {}): ModuleManifest {
  return {
    id,
    kind: 'feature',
    displayNameKey: `${id}:module.name`,
    dependsOn: [],
    optionalDependsOn: [],
    core: false,
    ...partial,
  }
}

const tempDirs: string[] = []
afterAll(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A fresh temp directory, removed after the test file. */
export function tempDir(prefix = 'pragma-sdk-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

export { type MemoryLogger, memoryLogger } from '@pragma/test-support'

export type FeatureRecordOptions = {
  /** Any `defineMainModule(...)` result, whatever its settings type. */
  main?: { activate(...args: never[]): unknown }
  manifest?: Partial<ModuleManifest>
  migrations?: [string, string][]
  testHooks?: TestHooks
  locales?: Record<string, LocaleTree>
  dir?: string
}

export function featureRecord(id: string, opts: FeatureRecordOptions = {}): ModuleRecord {
  return {
    manifest: manifest(id, opts.manifest),
    packageName: `@pragma/module-${id}`,
    version: '0.0.0',
    dir: opts.dir ?? `/modules/${id}`,
    extraResources: [],
    main: opts.main as MainModule<unknown> | undefined,
    migrations: (opts.migrations ?? []).map(([name, sql]) => ({ name, sql })),
    locales: opts.locales ?? { en: { module: { name: id } } },
    testHooks: opts.testHooks ? async () => ({ default: opts.testHooks as TestHooks }) : undefined,
  }
}

export function providerRecord(
  id: string,
  opts: { capabilities?: CapabilityRegistration[]; settings?: SettingsSection<unknown> } = {},
): ModuleRecord {
  return {
    ...featureRecord(id, { manifest: { kind: 'provider' } }),
    packageName: `@pragma/provider-${id}`,
    provider: {
      descriptor: defineProvider({
        id,
        displayNameKey: `${id}:provider.name`,
        icon: id,
        defaultCommand: id,
        defaultArgs: [],
      }),
      capabilities: opts.capabilities ?? [],
      settings: opts.settings,
    },
  }
}

export async function startHost(
  records: ModuleRecord[],
  opts: { userDataDir?: string; testMode?: boolean; platform?: FakePlatform } = {},
) {
  const t = await createTestModuleHost({
    modules: records,
    userDataDir: opts.userDataDir ?? tempDir(),
    testMode: opts.testMode ?? false,
    platform: opts.platform,
  })
  return { host: t.host, bridge: t.bridge, client: t.ipc, platform: t.platform, userDataDir: t.userDataDir, log: t.log }
}
