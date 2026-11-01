/** Shared Playwright helpers for the agent-status and provider status E2E tests (test code only). */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import { expect, type Locator, type Page, test } from '@playwright/test'
import { agentsIpc, BUILTIN_PROFILE_PREFIX, formatArgs, TERMINAL_MODE } from '@pragma/module-agents/contract'
import { projectsIpc } from '@pragma/module-projects/contract'
import { createFixtureRepo, isolatedGitEnv } from '@pragma/test-support'
import { forceNativeTheme, invokeIpc, type LaunchedApp, launchApp, saveScreen } from '@pragma/test-support/e2e'
import { AGENT_STATUS_DATA_ATTRS as A, AGENT_STATUS_TEST_IDS as T } from '../src/contract'
import type { AgentStatusTestGlobal, AgentStatusTestHooks } from '../src/main/test-hooks'

const CUSTOM_PROVIDER = 'custom'
const PROFILE_NAME = 'Status fake'
const POLL_MS = 100
const WAIT_MS = 10_000
const ENTER = '\r'

type Result<V> = { ok: true; value: V } | { ok: false; error: { code: string } }
const unwrap = <V>(r: Result<V>): V => {
  if (!r.ok) throw new Error(`projects call failed: ${r.error.code}`)
  return r.value
}

export interface StatusApp {
  launched: LaunchedApp
  repo: string
  home: string
  temp: string
  /** The main worktree (selected after launch). */
  worktreeId: string
  /** The `secondBranch` worktree, when requested. */
  secondWorktreeId?: string
  close(): Promise<void>
}

export interface LaunchOptions {
  env?: Record<string, string>
  disabledModules?: string[]
  /** Adds a second worktree on this branch before launch. */
  secondBranch?: string
}

/** Temp HOME/XDG/userData, a fixture repo added as a project and selected; the shell reads none of the user's files. */
export async function launchWithRepo(o: LaunchOptions = {}): Promise<StatusApp> {
  const temp = fs.realpathSync(fs.mkdtempSync(join(os.tmpdir(), 'pragma-status-e2e-')))
  const home = join(temp, 'home')
  const userDataDir = join(temp, 'user-data')
  for (const d of [home, userDataDir]) fs.mkdirSync(d)
  fs.writeFileSync(
    join(userDataDir, 'settings.json'),
    JSON.stringify({ projects: { worktreesRoot: join(temp, 'wt') }, terminal: { renderer: 'dom' } }),
  )
  const fixture = createFixtureRepo({ files: { 'README.md': '# fixture\n' } })
  const repo = fs.realpathSync(fixture.path)
  if (o.secondBranch) fixture.git('worktree', 'add', '-b', o.secondBranch, join(temp, 'second'))
  const xdg = Object.fromEntries(
    ['CONFIG', 'DATA', 'CACHE', 'STATE'].map((k) => [`XDG_${k}_HOME`, join(home, k.toLowerCase())]),
  )
  const env = {
    ...(isolatedGitEnv() as Record<string, string>),
    HOME: home,
    ZDOTDIR: home,
    SHELL: '/bin/zsh',
    ...xdg,
    ...o.env,
  }
  const launched = await launchApp({ userDataDir, env, disabledModules: o.disabledModules })
  const project = unwrap(await invokeIpc(launched.window, projectsIpc.addProject, { path: repo }))
  const [worktreeId, secondWorktreeId] = await waitForWorktrees(launched, project.id, o.secondBranch ? 2 : 1)
  unwrap(await invokeIpc(launched.window, projectsIpc.selectWorktree, { worktreeId: worktreeId ?? null }))
  return {
    launched,
    repo,
    home,
    temp,
    worktreeId: worktreeId as string,
    secondWorktreeId,
    async close() {
      await launched.close()
      fixture.cleanup()
      fs.rmSync(temp, { recursive: true, force: true })
    },
  }
}

/** Worktree ids of the project, main first, once `count` are known. */
async function waitForWorktrees(l: LaunchedApp, projectId: string, count: number): Promise<string[]> {
  const deadline = Date.now() + WAIT_MS
  for (;;) {
    const { worktrees } = await invokeIpc(l.window, projectsIpc.getState, undefined)
    const own = worktrees.filter((w) => w.projectId === projectId).sort((a, b) => Number(b.isMain) - Number(a.isMain))
    if (own.length >= count) return own.map((w) => w.id)
    if (Date.now() > deadline) throw new Error(`expected ${count} worktrees`)
    await new Promise((r) => setTimeout(r, POLL_MS))
  }
}

/** Per-test app lifecycle: `start()` launches, every app is closed after the test. */
export function registerStatusSuite(): { start(o?: LaunchOptions): Promise<StatusApp> } {
  const running: StatusApp[] = []
  test.afterEach(async () => {
    for (const a of running.splice(0)) await a.close()
  })
  return {
    async start(o) {
      const a = await launchWithRepo(o)
      running.push(a)
      return a
    },
  }
}

const PHASE = '04-bridge-agent-status'
const THEMES = ['dark', 'light'] as const

/** `docs/phases/reports/04-bridge-agent-status/screens/<name>-{dark,light}.png` (no spinning icon may be visible). */
export async function saveStatusScreens(l: LaunchedApp, name: string): Promise<void> {
  await l.window.evaluate(() =>
    (
      globalThis as unknown as { document: { activeElement: { blur?(): void } | null } }
    ).document.activeElement?.blur?.(),
  )
  for (const theme of THEMES) {
    await forceNativeTheme(l.app, l.window, theme)
    await saveScreen(l.window, PHASE, `${name}-${theme}`)
  }
}

/** Points a provider's built-in profile at a fake command; returns the profile id. */
export async function setProfile(
  l: LaunchedApp,
  providerId: string,
  o: { command: string; args: string[]; env?: Record<string, string> },
): Promise<string> {
  const id = `${BUILTIN_PROFILE_PREFIX}${providerId}`
  const patch = { command: o.command, args: formatArgs(o.args), env: o.env ?? {} }
  return (await invokeIpc(l.window, agentsIpc.updateProfile, { id, patch })).id
}

/** A new profile of the `custom` provider (no status capability). */
export async function createCustomProfile(
  l: LaunchedApp,
  o: { command: string; args?: string[]; env?: Record<string, string> },
): Promise<string> {
  const input = {
    providerId: CUSTOM_PROVIDER,
    name: PROFILE_NAME,
    command: o.command,
    args: formatArgs(o.args ?? []),
    env: o.env ?? {},
  }
  return (await invokeIpc(l.window, agentsIpc.createProfile, input)).id
}

export async function startSession(
  l: LaunchedApp,
  o: { profileId: string; worktreeId: string; initialPrompt?: string },
): Promise<string> {
  return (await invokeIpc(l.window, agentsIpc.startSession, { ...o, mode: TERMINAL_MODE })).id
}

export const tabBadge = (page: Page, sessionId: string): Locator =>
  page.locator(`[data-testid="${T.tabBadge}"][${A.sessionId}="${sessionId}"]`)
export const worktreeBadge = (page: Page, worktreeId: string): Locator =>
  page.locator(`[data-testid="${T.worktreeBadge}"][${A.worktreeId}="${worktreeId}"]`)
export const unreadPill = (page: Page, worktreeId: string): Locator =>
  page.locator(`[data-testid="${T.unread}"][${A.worktreeId}="${worktreeId}"]`)

/** The main-process test hooks of a launch (each call runs in a fresh event-loop turn). */
export function hooks(l: LaunchedApp): {
  [K in keyof AgentStatusTestHooks]: (
    ...a: Parameters<AgentStatusTestHooks[K]>
  ) => Promise<Awaited<ReturnType<AgentStatusTestHooks[K]>>>
} {
  const call =
    (key: keyof AgentStatusTestHooks) =>
    (...args: unknown[]) =>
      l.app.evaluate(
        async (_e, input) => {
          await new Promise((r) => setImmediate(r))
          const fn = (globalThis as unknown as AgentStatusTestGlobal).__pragmaAgentStatusTest[input.key] as (
            ...a: unknown[]
          ) => unknown
          return fn(...input.args)
        },
        { key, args },
      )
  const keys: (keyof AgentStatusTestHooks)[] = [
    'writeToSession',
    'setFallbackTimings',
    'useRecordingNotifications',
    'getNotifications',
    'clickNotification',
    'setAppFocused',
    'getStatus',
    'reportEvent',
  ]
  return Object.fromEntries(keys.map((k) => [k, call(k)])) as never
}

/** Types a line into the session's pty (followed by Enter). */
export async function send(l: LaunchedApp, sessionId: string, line: string): Promise<void> {
  await hooks(l).writeToSession(sessionId, `${line}${ENTER}`)
}

const sha = (path: string): string | null =>
  fs.existsSync(path) ? createHash('sha256').update(fs.readFileSync(path)).digest('hex') : null

/** `@real-agent` guard: hashes the given user config files now; `assert()` checks they are unchanged. */
export function expectConfigUnchanged(paths: string[]): { assert(): void } {
  const before = paths.map(sha)
  return {
    assert() {
      const after = paths.map(sha)
      for (const [i, p] of paths.entries()) if (before[i] !== after[i]) throw new Error(`${p} changed during the test`)
    },
  }
}

const FALLBACK_WAIT = { timeout: WAIT_MS }

/** The session reports `activity` as its source, and `say` output drives working → idle. */
export async function expectActivityFallback(l: LaunchedApp, sessionId: string): Promise<void> {
  await expect.poll(async () => (await hooks(l).getStatus(sessionId))?.source, FALLBACK_WAIT).toBe('activity')
  const tab = tabBadge(l.window, sessionId)
  await send(l, sessionId, 'say activity')
  await expect(tab).toHaveAttribute('data-status', 'working', FALLBACK_WAIT)
  await expect(tab).toHaveAttribute('data-status', 'idle', FALLBACK_WAIT)
}
