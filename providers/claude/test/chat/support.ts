/** Shared helpers for every Claude chat test (fake CLI processes, reports, temp Claude homes). */
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentProfile } from '@pragma/module-agents/contract'
import { aProfile } from '@pragma/module-agents/testing'
import { afterEach } from 'vitest'
import {
  FAKE_CLAUDE_ENV,
  fakeClaudePath,
  type ScenarioName,
  scenarioPath,
} from '../../testing/fake-claude-stream/scenario'

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

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

/** A temp dir (realpath) removed after the test. */
export function tempDir(prefix = 'pragma-claude-chat-'): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** A temp HOME with `.claude` as `CLAUDE_CONFIG_DIR`, plus a report path and a worktree dir. */
export function tempClaudeHome() {
  const root = tempDir()
  const home = join(root, 'home')
  const configDir = join(home, '.claude')
  const worktree = join(root, 'work tree ü')
  for (const d of [configDir, worktree]) mkdirSync(d, { recursive: true })
  return { root, home, configDir, worktree, report: join(root, 'report.jsonl') }
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

/** Env that points the fake at a scenario and a report. */
export const fakeEnv = (scenario: ScenarioName, report: string, extra: Record<string, string> = {}) => ({
  [FAKE_CLAUDE_ENV.scenario]: scenarioPath(scenario),
  [FAKE_CLAUDE_ENV.report]: report,
  ...extra,
})

export const profileFor = (command: string, args: string[] = [], env: Record<string, string> = {}): AgentProfile =>
  aProfile({ id: 'builtin:claude', providerId: 'claude', command, args, env })

export interface RunningFake {
  child: ChildProcessWithoutNullStreams
  send(frame: unknown): void
  /** Parsed JSON stdout lines so far. */
  frames(): Record<string, unknown>[]
  stdout(): string
  waitFor(pred: (f: Record<string, unknown>) => boolean, timeoutMs?: number): Promise<Record<string, unknown>>
  exited: Promise<number | null>
}

const WAIT_MS = 5000
const POLL_MS = 10

/** Spawns `fake-claude` with pipes (killed after the test). */
export function runFake(scenario: ScenarioName, opts: { args?: string[]; env?: Record<string, string>; cwd?: string }) {
  const h = tempClaudeHome()
  const child = spawn(fakeClaudePath, opts.args ?? [], {
    cwd: opts.cwd ?? h.worktree,
    env: { ...process.env, HOME: h.home, CLAUDE_CONFIG_DIR: h.configDir, ...fakeEnv(scenario, h.report), ...opts.env },
  })
  cleanups.push(() => child.kill('SIGKILL'))
  let out = ''
  child.stdout.on('data', (d: Buffer) => {
    out += d.toString()
  })
  const frames = () =>
    out
      .split('\n')
      .filter((l) => l.startsWith('{'))
      .map((l) => JSON.parse(l) as Record<string, unknown>)
  const fake: RunningFake = {
    child,
    send: (frame) => child.stdin.write(`${JSON.stringify(frame)}\n`),
    frames,
    stdout: () => out,
    async waitFor(pred, timeoutMs = WAIT_MS) {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const hit = frames().find(pred)
        if (hit) return hit
        if (Date.now() > deadline) throw new Error(`no matching frame; stdout:\n${out}`)
        await new Promise((r) => setTimeout(r, POLL_MS))
      }
    },
    exited: new Promise((resolve) => child.on('exit', (code) => resolve(code))),
  }
  return { fake, home: h }
}

export const userFrame = (text: string) => ({
  type: 'user',
  message: { role: 'user', content: [{ type: 'text', text }] },
  parent_tool_use_id: null,
})
export const initRequest = (id = 'init-1') => ({
  type: 'control_request',
  request_id: id,
  request: { subtype: 'initialize' },
})
