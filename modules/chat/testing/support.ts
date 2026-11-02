/** Shared builders for chat tests (this module, 11b, 11c). Test code only. */
import type { AgentStatusEvent } from '@pragma/module-agent-status/contract'
import type {
  AgentProfile,
  AgentSession,
  AgentSessionModeHandler,
  LaunchEnvContext,
  RelaunchOptions,
  SessionPatch,
} from '@pragma/module-agents/contract'
import { aProfile, aSession } from '@pragma/module-agents/testing'
import {
  CHAT_MODE,
  type ChatEvent,
  type ChatEventEnvelope,
  type ChatTranscript,
  emptyTranscript,
  reduceTranscript,
} from '../src/contract'
import type { ChatAgentsApi } from '../src/main/agents-adapter'

export const TEST_SESSION_ID = 's1'
export const TEST_WORKTREE_PATH = '/w'
export const TEST_AT = 1_000

export const makeEnvelope = (event: ChatEvent, seq: number, sessionId = TEST_SESSION_ID): ChatEventEnvelope => ({
  sessionId,
  seq,
  at: TEST_AT + seq,
  event,
})

/** Envelopes with seq 1..n. */
export const makeEnvelopes = (events: ChatEvent[], sessionId = TEST_SESSION_ID): ChatEventEnvelope[] =>
  events.map((e, i) => makeEnvelope(e, i + 1, sessionId))

export const makeProfile = (patch: Partial<AgentProfile> = {}): AgentProfile => aProfile(patch)

export const makeSession = (patch: Partial<AgentSession> = {}): AgentSession =>
  aSession(patch.id ?? TEST_SESSION_ID, 1, { mode: CHAT_MODE, ...patch })

export interface StubAgentsApi extends ChatAgentsApi {
  sessions: Map<string, AgentSession>
  profiles: Map<string, AgentProfile>
  updates: { id: string; patch: SessionPatch }[]
  relaunches: { id: string; opts: RelaunchOptions }[]
  envRequests: LaunchEnvContext[]
  reports: { sessionId: string; event: AgentStatusEvent }[]
  handlers: Map<string, AgentSessionModeHandler>
  files: string[]
  env: Record<string, string>
}

/** An in-memory `ChatAgentsApi` that records every write. */
export function stubAgentsApi(over: { session?: Partial<AgentSession>; profile?: Partial<AgentProfile> } = {}) {
  const session = makeSession(over.session)
  const profile = makeProfile(over.profile)
  const api: StubAgentsApi = {
    sessions: new Map([[session.id, session]]),
    profiles: new Map([[profile.id, profile]]),
    updates: [],
    relaunches: [],
    envRequests: [],
    reports: [],
    handlers: new Map(),
    files: [],
    env: { PATH: '/decorated/bin:/usr/bin', PRAGMA_SESSION_ID: session.id },
    getSession: async (id) => api.sessions.get(id) ?? null,
    getProfile: async (id) => api.profiles.get(id) ?? null,
    async updateSession(id, patch) {
      api.updates.push({ id, patch })
      const next = { ...(api.sessions.get(id) as AgentSession), ...patch } as AgentSession
      api.sessions.set(id, next)
      return next
    },
    async relaunchSession(id, opts = {}) {
      api.relaunches.push({ id, opts })
      return api.sessions.get(id) as AgentSession
    },
    registerModeHandler(mode, handler) {
      api.handlers.set(mode, handler)
      return () => api.handlers.delete(mode)
    },
    async buildLaunchEnv(ctx) {
      api.envRequests.push(ctx)
      return { ...api.env }
    },
    getWorktreePath: async () => TEST_WORKTREE_PATH,
    listWorktreeFiles: async () => [...api.files],
    reportStatus: (sessionId, event) => void api.reports.push({ sessionId, event }),
  }
  return api
}

/** The transcript of `events` (seq 1..n), as the renderer would build it live. */
export const makeTranscript = (events: ChatEvent[]): ChatTranscript =>
  makeEnvelopes(events).reduce(reduceTranscript, emptyTranscript())
