import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Logger } from '@pragma/sdk'
import {
  createMainHost,
  createMemoryTransport,
  type LogLevel,
  type LogSink,
  loggerFromSinks,
  type MainHost,
  type ModuleRecord,
  type NativeViewLike,
  type PragmaBridge,
} from '@pragma/sdk/runtime/main'
import { createIpcClient, type IpcClient } from '@pragma/sdk/runtime/renderer'
import { CORE_TEST_LOCALES, TEST_APP_VERSION } from './constants'
import { createFakePlatform, type FakePlatform } from './fake-platform'
import { createTempUserData } from './temp-user-data'

export interface LogLine {
  level: LogLevel
  scope: string
  message: string
  details: unknown[]
}

export type MemoryLogger = Logger & { lines: LogLine[]; messages(level?: LogLevel): string[] }

/** A logger that keeps every line in memory. */
export function memoryLogger(): MemoryLogger {
  const lines: LogLine[] = []
  const sink: LogSink = { write: (level, scope, message, details) => lines.push({ level, scope, message, details }) }
  return Object.assign(loggerFromSinks([sink]), {
    lines,
    messages: (level?: LogLevel) => lines.filter((l) => !level || l.level === level).map((l) => l.message),
  })
}

export interface FakeViewContainer {
  views: Set<NativeViewLike>
  add(view: NativeViewLike): void
  remove(view: NativeViewLike): void
}

export function fakeViewContainer(): FakeViewContainer {
  const views = new Set<NativeViewLike>()
  return { views, add: (v) => void views.add(v), remove: (v) => void views.delete(v) }
}

export interface TestModuleHost {
  host: MainHost
  ipc: IpcClient
  bridge: PragmaBridge
  userDataDir: string
  views: FakeViewContainer
  platform: FakePlatform
  log: MemoryLogger
  dispose(): Promise<void>
}

const SETTINGS_FILE = 'settings.json'

/** The real main host in-process, with a fake platform, an in-memory IPC pipe and a temp userData. */
export async function createTestModuleHost(opts: {
  modules: ModuleRecord[]
  userDataDir?: string
  testMode?: boolean
  settings?: Record<string, unknown>
  platform?: FakePlatform
}): Promise<TestModuleHost> {
  const temp = opts.userDataDir ? undefined : createTempUserData()
  const userDataDir = opts.userDataDir ?? (temp?.path as string)
  if (opts.settings) {
    mkdirSync(userDataDir, { recursive: true })
    writeFileSync(join(userDataDir, SETTINGS_FILE), JSON.stringify(opts.settings))
  }
  const { transport, bridge } = createMemoryTransport()
  const platform = opts.platform ?? createFakePlatform()
  const views = fakeViewContainer()
  const log = memoryLogger()
  const host = await createMainHost({
    records: opts.modules,
    coreLocales: CORE_TEST_LOCALES,
    userDataDir,
    transport,
    viewContainer: views,
    platform,
    testMode: opts.testMode ?? true,
    appVersion: TEST_APP_VERSION,
    log,
  })
  return {
    host,
    ipc: createIpcClient(bridge, log),
    bridge,
    userDataDir,
    views,
    platform,
    log,
    async dispose() {
      await host.dispose()
      temp?.cleanup()
    },
  }
}
