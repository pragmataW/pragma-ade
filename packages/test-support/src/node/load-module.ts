import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { CapabilityRegistration, SettingsSection } from '@pragma/sdk'
import type { MainModule, TestHooks } from '@pragma/sdk/main'
import type { ModuleRecord } from '@pragma/sdk/runtime/main'
import { collectExtraResources } from '../../../../scripts/lib/builds.ts'
import { discoverModuleDir } from '../../../../scripts/lib/discover.ts'
import { moduleLocales } from '../../../../scripts/lib/render.ts'
import { UTF8 } from './constants'

const importDefault = async <T>(file: string): Promise<T> => ((await import(file)) as { default: T }).default

async function providerPart(mod: ReturnType<typeof discoverModuleDir>): Promise<ModuleRecord['provider']> {
  const p = mod.provider
  if (!p) return undefined
  return {
    descriptor: await importDefault(p.descriptorFile),
    capabilities: await Promise.all(p.mainCapabilities.map((c) => importDefault<CapabilityRegistration>(c.file))),
    settings: p.settingsFile ? await importDefault<SettingsSection<unknown>>(p.settingsFile) : undefined,
  }
}

/** Loads a module folder the way the generated registry would (for in-process tests). */
export async function loadModuleRecord(dir: string): Promise<ModuleRecord> {
  const mod = discoverModuleDir(dir)
  const { resources } = collectExtraResources([mod])
  const testHooks = mod.testHooks
  return {
    manifest: mod.manifest,
    packageName: mod.packageName,
    version: mod.version,
    dir: mod.dir,
    extraResources: resources.map((r) => ({ from: r.from, to: r.moduleTo })),
    main: mod.mainEntry ? await importDefault<MainModule<unknown>>(mod.mainEntry) : undefined,
    migrations: mod.migrations.map((file) => ({ name: basename(file), sql: readFileSync(file, UTF8) })),
    locales: moduleLocales(mod).locales as ModuleRecord['locales'],
    testHooks: testHooks ? async () => ({ default: await importDefault<TestHooks>(testHooks) }) : undefined,
    provider: await providerPart(mod),
  }
}
