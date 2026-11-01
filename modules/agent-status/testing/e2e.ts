/** Shared Playwright helpers for the agent-status and provider status E2E tests (test code only). */
import { createHash } from 'node:crypto'
import * as fs from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import type { Locator, Page } from '@playwright/test'
import { agentsIpc, BUILTIN_PROFILE_PREFIX, formatArgs, TERMINAL_MODE } from '@pragma/module-agents/contract'
import { projectsIpc } from '@pragma/module-projects/contract'
import { createFixtureRepo, isolatedGitEnv } from '@pragma/test-support'
import { invokeIpc, type LaunchedApp, launchApp } from '@pragma/test-support/e2e'
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
  worktreeId: string
  close(): Promise<void>
}

/** Temp HOME/XDG/userData, a fixture repo added as a project and selected; the shell reads none of the user's files. */
export async function launchWithRepo(
  o: { env?: Record<string, string>; disabledModules?: string[] } = {},
): Promise<StatusApp> {
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
  const worktreeId = await waitForMainWorktree(launched, project.id)
  unwrap(await invokeIpc(launched.window, projectsIpc.selectWorktree, { worktreeId }))
  return {
    launched,
    repo,
    home,
    temp,
    worktreeId,
    async close() {
      await launched.close()
      fixture.cleanup()
      fs.rmSync(temp, { recursive: true, force: true })
    },
  }
}

async function waitForMainWorktree(l: LaunchedApp, projectId: string): Promise<string> {
  const deadline = Date.now() + WAIT_MS
  for (;;) {
    const { worktrees } = await invokeIpc(l.window, projectsIpc.getState, undefined)
    const main = worktrees.find((w) => w.projectId === projectId && w.isMain)
    if (main) return main.id
    if (Date.now() > deadline) throw new Error('no main worktree')
    await new Promise((r) => setTimeout(r, POLL_MS))
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
