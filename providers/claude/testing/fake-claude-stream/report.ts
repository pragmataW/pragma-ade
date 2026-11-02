/** Reading `FAKE_CLAUDE_REPORT` (shared by unit and E2E tests; no test-runner imports). */
import { existsSync, readFileSync } from 'node:fs'

export interface FakeReport {
  pid: number
  startedAt: number
  argv: string[]
  cwd: string
  env: Record<string, string>
  sessionId: string
  userMessages: { at: number; frame: Record<string, unknown> }[]
  controlRequests: { request_id: string; request: Record<string, unknown> }[]
  controlResponses: { response: { request_id: string; response?: Record<string, unknown> } }[]
  results: { at: number; subtype: string }[]
}

/** Every report line (one per state change, all processes). */
export function readReport(path: string): FakeReport[] {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => JSON.parse(l) as FakeReport)
}

/** The latest state of the last process. */
export const lastReport = (path: string): FakeReport | undefined => readReport(path).at(-1)

/** Distinct processes (one entry per pid, latest state). */
export function processes(path: string): FakeReport[] {
  const byPid = new Map<number, FakeReport>()
  for (const r of readReport(path)) byPid.set(r.pid, r)
  return [...byPid.values()]
}

/** `--flag=value` and `--flag value` spellings normalized (the SDK uses the former). */
export const normalizeArgv = (argv: readonly string[]): string[] =>
  argv.flatMap((a) => (a.startsWith('--') && a.includes('=') ? a.split(/=(.*)/s).slice(0, 2) : [a]))

/** The value after `flag` (either spelling), if present. */
export function flagValue(argv: readonly string[], flag: string): string | undefined {
  const n = normalizeArgv(argv)
  return n.includes(flag) ? n[n.indexOf(flag) + 1] : undefined
}
