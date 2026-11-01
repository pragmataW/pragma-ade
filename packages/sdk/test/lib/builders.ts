import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll } from 'vitest'
import type { Logger } from '../../src/common/logger'
import type { ModuleManifest } from '../../src/common/manifest'
import { type LogLevel, type LogSink, loggerFromSinks } from '../../src/runtime/main/logger'

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
