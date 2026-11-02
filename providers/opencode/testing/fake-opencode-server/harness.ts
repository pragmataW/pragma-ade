/** Shared helpers for every OpenCode chat test (fake `opencode serve`, contexts, emits, locales). Test code only. */
import { type ChildProcess, type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AgentProfile } from '@pragma/module-agents/contract'
import { aProfile } from '@pragma/module-agents/testing'
import type { ChatEvent, ChatSessionContext } from '@pragma/module-chat/contract'

import { PASSWORD_ENV, SERVE_ARGS } from '../../src/main/chat/constants'
import {
  BIN,
  FAKE_DIR,
  FAKE_ENV,
  type FakeLogRecord,
  type FakeMode,
  type FakeRequestRecord,
  parseLog,
  type ScenarioName,
  scenarioPath,
} from './paths'

export * from './paths'

const PROVIDER_ROOT = join(FAKE_DIR, '..', '..')

export const FAKE_SID = 'ses_test'
export const FAKE_AMID = 'msg_test'

interface ScenarioStep {
  emit?: { type: string; data: Record<string, unknown> }
}
interface Scenario {
  version: string
  turns: { steps: ScenarioStep[] }[]
}

export const readScenario = (name: ScenarioName): Scenario =>
  JSON.parse(readFileSync(scenarioPath(name), 'utf8')) as Scenario

const fill = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v).replaceAll('$SID', FAKE_SID).replaceAll('$AMID', FAKE_AMID))

/** The `emit` steps of a scenario turn as raw v2 SSE events (`id` `evt_<n>`). */
export function scenarioEvents(name: ScenarioName, turn = 0): { id: string; type: string; data: unknown }[] {
  const steps = readScenario(name).turns[turn]?.steps ?? []
  return steps.flatMap((s, i) => (s.emit ? [{ id: `evt_${i}`, type: s.emit.type, data: fill(s.emit.data) }] : []))
}

/** This provider's English locale tree (`locales/en/*.json`, merged like the generator). */
export function providerLocale(): Record<string, unknown> {
  const dir = join(PROVIDER_ROOT, 'locales', 'en')
  const files = ['chat.json', 'chatUi.json', 'provider.json']
  return Object.assign({}, ...files.map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8'))))
}

/** The English copy of an `opencode:` key, or undefined. */
export function lookupLocale(key: string): unknown {
  const path = key.slice(key.indexOf(':') + 1).split('.')
  return path.reduce<unknown>((node, k) => (node as Record<string, unknown> | undefined)?.[k], providerLocale())
}

/** An OpenCode profile whose command runs the fake through node. */
export const fakeProfile = (o: { prefixArgs?: string[]; env?: Record<string, string>; command?: string } = {}) =>
  aProfile({
    id: 'builtin:opencode',
    providerId: 'opencode',
    command: o.command ?? process.execPath,
    args: o.command ? (o.prefixArgs ?? []) : [BIN, ...(o.prefixArgs ?? [])],
    env: o.env ?? {},
  }) as AgentProfile

/** A `ChatSessionContext` whose `emit` records into `events`. */
export function ctxFor(o: {
  profile: AgentProfile
  worktreePath: string
  env?: Record<string, string>
  sessionId?: string
  resumeExternalSessionId?: string
  initialOptions?: ChatSessionContext['initialOptions']
  startupTimeoutMs?: number
}): { ctx: ChatSessionContext; events: ChatEvent[] } {
  const events: ChatEvent[] = []
  const ctx: ChatSessionContext = {
    sessionId: o.sessionId ?? 'pragma-session-1',
    profile: o.profile,
    worktreePath: o.worktreePath,
    env: o.env ?? { PATH: process.env.PATH ?? '' },
    resumeExternalSessionId: o.resumeExternalSessionId,
    initialOptions: o.initialOptions,
    startupTimeoutMs: o.startupTimeoutMs ?? 10_000,
    emit: (e) => void events.push(e),
  }
  return { ctx, events }
}

export const kinds = (events: ChatEvent[]): string[] => events.map((e) => e.kind)
export const ofKind = <K extends ChatEvent['kind']>(events: ChatEvent[], kind: K) =>
  events.filter((e): e is Extract<ChatEvent, { kind: K }> => e.kind === kind)

// ── processes and temp dirs ────────────────────────────────────────────────

const cleanups: (() => void)[] = []
/** Kills every fake and removes every temp dir created since the last call (call it in `afterEach`). */
export function cleanupFakes(): void {
  for (const c of cleanups.splice(0).reverse()) c()
}

/** A realpath temp dir, removed by `cleanupFakes`. */
export function tempDir(prefix = 'pragma-opencode-chat-'): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** A throwaway HOME/XDG tree, a worktree, a log path and a state dir (OpenCode never sees the real user dirs). */
export function tempOpencodeHome() {
  const root = tempDir()
  const home = join(root, 'home')
  const worktree = join(root, 'work tree ü')
  for (const d of [home, worktree]) mkdirSync(d, { recursive: true })
  const env = {
    HOME: home,
    XDG_CONFIG_HOME: join(home, '.config'),
    XDG_DATA_HOME: join(home, '.local', 'share'),
    XDG_STATE_HOME: join(home, '.local', 'state'),
    XDG_CACHE_HOME: join(home, '.cache'),
  }
  return { root, home, worktree, env, log: join(root, 'fake.jsonl'), stateDir: join(root, 'state') }
}

export type FakeHome = ReturnType<typeof tempOpencodeHome>

/** Env that points the fake at a scenario, mode, log and state dir. */
export function fakeEnv(
  h: FakeHome,
  o: { scenario?: ScenarioName; mode?: FakeMode; logEnv?: string[]; testRoutes?: boolean } = {},
): Record<string, string> {
  return {
    ...h.env,
    [FAKE_ENV.scenario]: scenarioPath(o.scenario ?? 'basic'),
    [FAKE_ENV.mode]: o.mode ?? 'normal',
    [FAKE_ENV.log]: h.log,
    [FAKE_ENV.stateDir]: h.stateDir,
    [FAKE_ENV.logEnv]: (o.logEnv ?? []).join(','),
    ...(o.testRoutes ? { [FAKE_ENV.testRoutes]: '1' } : {}),
  }
}

export const auth = (password: string): string => `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`
export const readLog = (path: string): FakeLogRecord[] => (existsSync(path) ? parseLog(readFileSync(path, 'utf8')) : [])
export const requestsOf = (path: string, re?: RegExp): FakeRequestRecord[] =>
  readLog(path).filter((r): r is FakeRequestRecord => r.kind === 'request' && (!re || re.test(r.path)))
export const lastBody = (path: string, re: RegExp): unknown => requestsOf(path, re).at(-1)?.body

const WAIT_MS = 5000
const POLL_MS = 10

/** Polls `pred` until it returns a value (not undefined/false) or times out. */
export async function until<T>(pred: () => T | undefined | false, timeoutMs = WAIT_MS): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const v = pred()
    if (v !== undefined && v !== false) return v
    if (Date.now() > deadline) throw new Error('until: timed out')
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** The first `kind` event (matching `pred`) in `events`, waiting for it. */
export const waitForEvent = <K extends ChatEvent['kind']>(
  events: ChatEvent[],
  kind: K,
  pred: (e: Extract<ChatEvent, { kind: K }>) => boolean = () => true,
  timeoutMs = WAIT_MS,
) => until(() => ofKind(events, kind).find(pred), timeoutMs)

export const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export const exitCodeOf = (p: ChildProcess): Promise<number | null> =>
  p.exitCode !== null || p.signalCode !== null
    ? Promise.resolve(p.exitCode)
    : new Promise((r) => p.once('exit', (code) => r(code)))

/** Registers a spawned process for `cleanupFakes`. */
export function trackProcess(p: ChildProcess): void {
  cleanups.push(() => {
    if (p.exitCode === null && p.signalCode === null) p.kill('SIGKILL')
  })
}

export interface RunningFake {
  proc: ChildProcessWithoutNullStreams
  url: string
  password: string
  home: FakeHome
  log: string
  headers: Record<string, string>
  stdout(): string
}

/** Spawns the fake `serve --stdio` directly and waits for its ready line (stdout is returned for no-ready modes). */
export async function startFake(
  o: {
    scenario?: ScenarioName
    mode?: FakeMode
    env?: Record<string, string>
    prefixArgs?: string[]
    logEnv?: string[]
    testRoutes?: boolean
    waitReady?: boolean
  } = {},
): Promise<RunningFake> {
  const home = tempOpencodeHome()
  const password = 'test-password'
  const env = {
    PATH: process.env.PATH ?? '',
    ...fakeEnv(home, { ...o, logEnv: o.logEnv ?? Object.keys(o.env ?? {}) }),
    [PASSWORD_ENV]: password,
    ...o.env,
  }
  const proc = spawn(process.execPath, [BIN, ...(o.prefixArgs ?? []), ...SERVE_ARGS], { cwd: home.worktree, env })
  trackProcess(proc)
  let out = ''
  proc.stdout.on('data', (d: Buffer) => {
    out += d.toString()
  })
  const url = o.waitReady === false ? '' : ((await until(() => /"url":"([^"]+)"/.exec(out)?.[1], WAIT_MS)) as string)
  return { proc, url, password, home, log: home.log, headers: { authorization: auth(password) }, stdout: () => out }
}

/** GET/POST against a running fake with auth. */
export async function call(f: RunningFake, path: string, init: { method?: string; body?: unknown } = {}) {
  const res = await fetch(f.url + path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: { ...f.headers, 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  return { status: res.status, json: text ? (JSON.parse(text) as Record<string, unknown>) : null }
}

/** Seeds the fake's state dir with one session holding `messages` (history tests). */
export function seedState(h: FakeHome, sessionId: string, messages: unknown[]): void {
  mkdirSync(h.stateDir, { recursive: true })
  const info = { id: sessionId, cost: 0, title: '' }
  writeFileSync(
    join(h.stateDir, 'state.json'),
    JSON.stringify({ sessions: { [sessionId]: { info, messages, turns: 0 } } }),
  )
}

async function pumpSse(res: Response, onEvent: (e: { type: string; data: Record<string, unknown> }) => void) {
  const reader = res.body?.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  for (let next = await reader?.read(); next && !next.done; next = await reader?.read()) {
    buf += decoder.decode(next.value)
    const blocks = buf.split('\n\n')
    buf = blocks.pop() ?? ''
    for (const b of blocks) if (b.startsWith('data: ')) onEvent(JSON.parse(b.slice('data: '.length)))
  }
}

/** Reads the fake's SSE stream into `events` (raw v2 envelopes) until `close()`. */
export function subscribeSse(f: RunningFake) {
  const events: { type: string; data: Record<string, unknown> }[] = []
  const ac = new AbortController()
  const done = fetch(`${f.url}/api/event`, { headers: f.headers, signal: ac.signal })
    .then((res) => pumpSse(res, (e) => events.push(e)))
    .catch(() => undefined)
  return {
    events,
    waitFor: (type: string) => until(() => events.find((e) => e.type === type)),
    close: async () => {
      ac.abort()
      await done
    },
  }
}

/** Creates a session on the fake; returns its id. */
export async function newSession(f: RunningFake): Promise<string> {
  const r = await call(f, '/api/session', { body: {} })
  return (r.json as { data: { id: string } }).data.id
}

export type FakeOptions = {
  scenario?: ScenarioName
  mode?: FakeMode
  prefixArgs?: string[]
  env?: Record<string, string>
  logEnv?: string[]
  testRoutes?: boolean
}

/** The env a chat context would get for a fake server in `h` (shell PATH + fake vars + extra env). */
export const fakeContextEnv = (h: FakeHome, o: FakeOptions = {}): Record<string, string> => ({
  PATH: process.env.PATH ?? '',
  ...fakeEnv(h, o),
  ...o.env,
})

/** `ConnectionPool.acquire` input for a fake server in `h`. */
export const fakeServeInput = (h: FakeHome, o: FakeOptions = {}) => ({
  profile: fakeProfile({ prefixArgs: o.prefixArgs }),
  worktreePath: h.worktree,
  env: fakeContextEnv(h, o),
  startupTimeoutMs: 10_000,
})

export const silentLog = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
}
