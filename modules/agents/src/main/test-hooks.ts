import { defineTestHooks, type MainContext } from '@pragma/sdk/main'
import { TEST_OUTPUT_CAP_BYTES, WAIT_POLL_MS, WAIT_STATUS_MS } from '../constants'
import {
  type AgentProfile,
  type AgentSession,
  type AgentSessionStatus,
  agentSessionStarted,
  type CreateProfileInput,
  type ProfileCheck,
  type RelaunchOptions,
  type StartSessionInput,
  type UpdateProfilePatch,
} from '../contract'
import { type AgentsMainRuntime, getMainRuntime } from './runtime'

/** `globalThis.__pragmaAgentsTest`, installed only when `PRAGMA_TEST=1` (§8). */
export interface AgentsTestHooks {
  createProfile(input: CreateProfileInput): Promise<AgentProfile>
  updateProfile(id: string, patch: UpdateProfilePatch): Promise<AgentProfile>
  listProfiles(): Promise<AgentProfile[]>
  listSessions(worktreeId: string): Promise<AgentSession[]>
  getSession(id: string): Promise<AgentSession | null>
  startSession(input: StartSessionInput): Promise<AgentSession>
  relaunchSession(id: string, opts?: RelaunchOptions): Promise<AgentSession>
  closeSession(id: string): Promise<void>
  checkProfile(id: string): Promise<ProfileCheck>
  /** Pty output captured since `agentSession.started` (capped). */
  getSessionOutput(sessionId: string): string
  waitForSessionStatus(sessionId: string, status: AgentSessionStatus, timeoutMs?: number): Promise<AgentSession>
}
export type AgentsTestGlobal = { __pragmaAgentsTest: AgentsTestHooks }

export class WaitForStatusTimeoutError extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** The hook object over the active runtime; output capture subscribes to `agentSession.started`. */
export function createAgentsTestHooks(
  rt: AgentsMainRuntime,
  events: Pick<MainContext['events'], 'on'>,
): AgentsTestHooks {
  const { service, profiles } = rt
  const output = new Map<string, string>()
  const published = <T>(value: T): T => {
    rt.publishProfiles()
    return value
  }
  events.on(agentSessionStarted, ({ sessionId, ptyId }) => {
    if (!ptyId) return
    rt.pty.onData(ptyId, (data) => {
      const next = (output.get(sessionId) ?? '') + data
      output.set(sessionId, next.slice(-TEST_OUTPUT_CAP_BYTES))
    })
  })
  return {
    createProfile: async (input) => published(profiles.create(input)),
    updateProfile: async (id, patch) => published(profiles.update(id, patch)),
    listProfiles: async () => profiles.list(),
    listSessions: (worktreeId) => service.listSessions(worktreeId),
    getSession: (id) => service.getSession(id),
    startSession: (input) => service.startSession(input),
    relaunchSession: (id, opts) => service.relaunchSession(id, opts),
    closeSession: (id) => service.closeSession(id),
    checkProfile: (id) => rt.checker.check(id),
    getSessionOutput: (sessionId) => output.get(sessionId) ?? '',
    async waitForSessionStatus(sessionId, status, timeoutMs = WAIT_STATUS_MS) {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const s = await service.getSession(sessionId)
        if (s?.status === status) return s
        if (Date.now() > deadline)
          throw new WaitForStatusTimeoutError(`session ${sessionId} not ${status} after ${timeoutMs}ms (${s?.status})`)
        await sleep(WAIT_POLL_MS)
      }
    },
  }
}

export default defineTestHooks((ctx) => {
  ;(globalThis as unknown as AgentsTestGlobal).__pragmaAgentsTest = createAgentsTestHooks(getMainRuntime(), ctx.events)
})
