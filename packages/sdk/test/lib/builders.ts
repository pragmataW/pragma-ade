import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'
import type { Logger } from '../../src/common/logger'
import type { ModuleManifest } from '../../src/common/manifest'
import { type CapabilityRegistration, defineProvider } from '../../src/common/providers'
import type { SettingsSection } from '../../src/common/settings'
import type { MainModule, TestHooks } from '../../src/main/types'
import { type LogLevel, type LogSink, loggerFromSinks } from '../../src/runtime/main/logger'
import { createMainHost } from '../../src/runtime/main/main-host'
import type { NativeViewLike } from '../../src/runtime/main/native-view-host'
import type { ModuleRecord } from '../../src/runtime/main/types'
import { createIpcClient } from '../../src/runtime/renderer/ipc-client'
import type { LocaleTree } from '../../src/runtime/shared/i18n-resources'
import { createMemoryTransport } from '../../src/runtime/shared/memory-transport'
import { createFakePlatform, type FakePlatform } from './fake-platform'

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

export interface LogLine {
  level: LogLevel
  scope: string
  message: string
  details: unknown[]
}

export type MemoryLogger = Logger & { lines: LogLine[]; messages(level?: LogLevel): string[] }

export function memoryLogger(): MemoryLogger {
  const lines: LogLine[] = []
  const sink: LogSink = { write: (level, scope, message, details) => lines.push({ level, scope, message, details }) }
  return Object.assign(loggerFromSinks([sink]), {
    lines,
    messages: (level?: LogLevel) => lines.filter((l) => !level || l.level === level).map((l) => l.message),
  })
}

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

export function fakeViewContainer() {
  const views = new Set<NativeViewLike>()
  return { views, add: (v: NativeViewLike) => views.add(v), remove: (v: NativeViewLike) => views.delete(v) }
}

export async function startHost(
  records: ModuleRecord[],
  opts: { userDataDir?: string; testMode?: boolean; platform?: FakePlatform } = {},
) {
  const { transport, bridge } = createMemoryTransport()
  const platform = opts.platform ?? createFakePlatform()
  const userDataDir = opts.userDataDir ?? tempDir()
  const log = memoryLogger()
  const host = await createMainHost({
    records,
    coreLocales: { en: { dialogs: { confirm: 'OK', cancel: 'Cancel' } } },
    userDataDir,
    transport,
    viewContainer: fakeViewContainer(),
    platform,
    testMode: opts.testMode ?? false,
    appVersion: '0.0.0-test',
    log,
  })
  return { host, bridge, client: createIpcClient(bridge, log), platform, userDataDir, log }
}
