import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { APP_DIR_NAMES, CORE_MODULE_ID } from '@pragma/sdk'
import { writeFileAtomic } from '@pragma/sdk/main'
import { SETTINGS_POLL_MS, SETTINGS_WAIT_MS } from './constants'

const UTF8 = 'utf8'
const INDENT = 2

export type SettingsFile = Record<string, Record<string, unknown>>

export class SettingsWaitTimeoutError extends Error {}

const settingsPath = (userDataDir: string): string => join(userDataDir, APP_DIR_NAMES.settings)

/** Parses `<userData>/settings.json`; a missing file reads as `{}`. */
export function readSettingsFile(userDataDir: string): SettingsFile {
  const path = settingsPath(userDataDir)
  if (!existsSync(path)) return {}
  return JSON.parse(readFileSync(path, UTF8)) as SettingsFile
}

/** Writes `core.modules.disabled` before launch, keeping every other section and key. */
export function writeDisabledModules(userDataDir: string, disabled: readonly string[]): void {
  const current = readSettingsFile(userDataDir)
  const core = current[CORE_MODULE_ID] ?? {}
  const modules = (core.modules as Record<string, unknown> | undefined) ?? {}
  const next: SettingsFile = {
    ...current,
    [CORE_MODULE_ID]: { ...core, modules: { ...modules, disabled: [...disabled] } },
  }
  writeFileAtomic(settingsPath(userDataDir), `${JSON.stringify(next, null, INDENT)}\n`)
}

/** Polls settings.json until `predicate` holds; returns the matching contents. */
export async function waitForSettings(
  userDataDir: string,
  predicate: (s: SettingsFile) => boolean,
  timeoutMs = SETTINGS_WAIT_MS,
): Promise<SettingsFile> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    let current: SettingsFile = {}
    try {
      current = readSettingsFile(userDataDir)
    } catch {
      // a half-written file is retried on the next poll
    }
    if (predicate(current)) return current
    if (Date.now() > deadline) throw new SettingsWaitTimeoutError(`settings predicate not met in ${timeoutMs}ms`)
    await new Promise((r) => setTimeout(r, SETTINGS_POLL_MS))
  }
}
