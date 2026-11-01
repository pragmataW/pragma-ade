import type { AgentSession, LaunchSpec, SessionPatch } from '@pragma/module-agents/contract'
import { aSession } from '@pragma/module-agents/testing'
import type { BridgeServer } from '@pragma/module-bridge/contract'
import { memoryLogger } from '@pragma/test-support'
import { vi } from 'vitest'
import type {
  AgentSessionStatusChangedPayload,
  SessionStatusInfo,
  StatusCapability,
  WorktreeStatusInfo,
} from '../../src/contract'
import { StatusStore, type StatusStoreDeps } from '../../src/main/status-store'
import { type FakeClock, fakeClock } from './fake-clock'

export const TIMINGS = { hookGraceMs: 30_000, activityIdleMs: 5_000 }

/** In-memory `AgentSessionsService` subset: sessions by id, recorded `updateSession` calls. */
export function fakeAgents(sessions: AgentSession[] = [aSession('s1', 1)]) {
  const byId = new Map(sessions.map((s) => [s.id, s]))
  const updates: [string, SessionPatch][] = []
  let failNext = false
  return {
    updates,
    failNextUpdate: () => {
      failNext = true
    },
    getSession: vi.fn(async (id: string) => byId.get(id) ?? null),
    updateSession: vi.fn(async (id: string, patch: SessionPatch) => {
      if (failNext) {
        failNext = false
        throw new Error('db busy')
      }
      updates.push([id, patch])
      const s = byId.get(id) as AgentSession
      return { ...s, ...patch } as AgentSession
    }),
  }
}

export interface StoreHarness {
  store: StatusStore
  clock: FakeClock
  agents: ReturnType<typeof fakeAgents>
  emitted: AgentSessionStatusChangedPayload[]
  sessions: SessionStatusInfo[]
  worktrees: WorktreeStatusInfo[]
  log: ReturnType<typeof memoryLogger>
  setActive(id: string | null): void
}

/** A `StatusStore` over fakes; the active worktree is `w-other` unless set. */
export function storeHarness(over: Partial<StatusStoreDeps> = {}, sessions?: AgentSession[]): StoreHarness {
  const clock = fakeClock(1000)
  const agents = fakeAgents(sessions)
  const emitted: AgentSessionStatusChangedPayload[] = []
  const infos: SessionStatusInfo[] = []
  const worktrees: WorktreeStatusInfo[] = []
  const log = memoryLogger()
  let active: string | null = 'w-other'
  const store = new StatusStore({
    agents,
    emitStatusChanged: (p) => emitted.push(p),
    publish: { session: (i) => infos.push(i), worktree: (i) => worktrees.push(i) },
    activeWorktreeId: () => active,
    clock,
    timings: () => TIMINGS,
    log,
    ...over,
  })
  return {
    store,
    clock,
    agents,
    emitted,
    sessions: infos,
    worktrees,
    log,
    setActive: (id) => {
      active = id
    },
  }
}

/** A status capability that records launches and maps `{ kind }` objects to themselves. */
export function fakeStatusCapability(over: Partial<StatusCapability> = {}) {
  const calls: { spec: LaunchSpec; bridgeUrl: string; bridgeToken: string }[] = []
  const cap: StatusCapability = {
    async decorateLaunch(spec, ctx) {
      calls.push({ spec, bridgeUrl: ctx.bridgeUrl, bridgeToken: ctx.bridgeToken })
      return { ...spec, args: ['--hooked', ...spec.args] }
    },
    parseEvent: (raw) => (raw && typeof raw === 'object' && 'kind' in raw ? (raw as never) : null),
    ...over,
  }
  return { cap, calls }
}

export const fakeBridge = (): BridgeServer =>
  ({ url: 'http://127.0.0.1:4000', token: 'tok', wsUrl: 'ws://127.0.0.1:4000/ws' }) as BridgeServer
