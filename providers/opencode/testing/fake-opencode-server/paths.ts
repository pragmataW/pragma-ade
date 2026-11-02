/** Paths and env names of the fake `opencode` (no test-runner imports: shared by Vitest and Playwright). */
import { join } from 'node:path'

export const FAKE_DIR = import.meta.dirname
export const BIN = join(FAKE_DIR, 'bin.mjs')
export const SCENARIOS = ['basic', 'form-retry', 'long-turn'] as const
export type ScenarioName = (typeof SCENARIOS)[number]
export const scenarioPath = (name: ScenarioName): string => join(FAKE_DIR, 'scenarios', `${name}.json`)

export const FAKE_ENV = {
  scenario: 'FAKE_OPENCODE_SCENARIO',
  log: 'FAKE_OPENCODE_LOG',
  logEnv: 'FAKE_OPENCODE_LOG_ENV',
  stateDir: 'FAKE_OPENCODE_STATE_DIR',
  testRoutes: 'FAKE_OPENCODE_TEST_ROUTES',
  mode: 'FAKE_OPENCODE_MODE',
} as const

export const FAKE_MODES = ['normal', 'no-ready', 'exit-early', 'legacy-1x', 'ignore-lease'] as const
export type FakeMode = (typeof FAKE_MODES)[number] | `version:${string}` | `die-after-ms:${number}`

export interface FakeStartRecord {
  kind: 'start'
  pid: number
  argv: string[]
  cwd: string
  env: Record<string, string>
  passwordSet: boolean
}
export interface FakeRequestRecord {
  kind: 'request'
  method: string
  path: string
  query: Record<string, string>
  body: unknown
  directoryHeader: string | null
}
export interface FakeFormCancelRecord {
  kind: 'form-cancel'
  formId: string
  message: string | null
}
export type FakeLogRecord = FakeStartRecord | FakeRequestRecord | FakeFormCancelRecord

/** The fake's JSONL log (empty when the file does not exist yet). */
export function parseLog(text: string): FakeLogRecord[] {
  return text
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as FakeLogRecord)
}
