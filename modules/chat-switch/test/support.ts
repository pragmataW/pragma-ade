/** Shared builders for every chat-switch unit test (§9.1: no copied setup). */
import type { AgentProfile, AgentSession, LaunchDecorator, RelaunchOptions } from '@pragma/module-agents/contract'
import { aProfile, aSession } from '@pragma/module-agents/testing'
import type { ChatCapability } from '@pragma/module-chat/contract'
import type { DeliverFn } from '@pragma/module-comments/contract'
import type { CapabilityMap, Logger } from '@pragma/sdk'
import { createEventBus } from '@pragma/sdk/runtime/main'
import { vi } from 'vitest'
import type { ResumeCapability } from '../src/contract'

export const SESSION_ID = 's1'
export const OTHER_SESSION_ID = 's2'
export const CLAUDE = 'claude'
export const OPENCODE = 'opencode'
export const EXTERNAL_ID = '3f2c9a1e-8d4b-4c1a-9f00-1234567890ab'
export const SERVE_URL = 'http://127.0.0.1:43123'

export const makeProfile = (patch: Partial<AgentProfile> = {}): AgentProfile =>
  aProfile({ id: `builtin:${CLAUDE}`, providerId: CLAUDE, ...patch })

export const makeSession = (patch: Partial<AgentSession> = {}): AgentSession =>
  aSession(patch.id ?? SESSION_ID, 1, {
    providerId: CLAUDE,
    profileId: `builtin:${CLAUDE}`,
    mode: 'chat',
    status: 'idle',
    externalSessionId: EXTERNAL_ID,
    ...patch,
  })

export const silentLog = (): Logger => {
  const log: Logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => log }
  return log
}

/** 03's sessions service: one map of sessions, recorded relaunches and decorators. */
export function fakeAgents(sessions: AgentSession[] = [makeSession()]) {
  const rows = new Map(sessions.map((s) => [s.id, s]))
  const decorators: LaunchDecorator[] = []
  const relaunches: { id: string; opts: RelaunchOptions }[] = []
  const agents = {
    rows,
    decorators,
    relaunches,
    getSession: vi.fn(async (id: string) => rows.get(id) ?? null),
    getProfile: vi.fn(async (id: string) => makeProfile({ id, providerId: id.split(':')[1] ?? CLAUDE })),
    relaunchSession: vi.fn(async (id: string, opts: RelaunchOptions = {}) => {
      relaunches.push({ id, opts })
      const s = { ...(rows.get(id) ?? makeSession({ id })), mode: opts.mode ?? 'terminal', status: 'starting' as const }
      rows.set(id, s)
      return s
    }),
    registerLaunchDecorator: vi.fn((d: LaunchDecorator) => {
      decorators.push(d)
      return () => undefined
    }),
  }
  return agents
}
export type FakeAgents = ReturnType<typeof fakeAgents>

/** 05's `CommentsService`: only the delivery-target registration matters here. */
export function fakeComments() {
  const targets = new Map<string, DeliverFn>()
  return {
    targets,
    registerDeliveryTarget: vi.fn((mode: string, fn: DeliverFn) => {
      targets.set(mode, fn)
      return () => targets.delete(mode)
    }),
  }
}

export interface FakeCaps {
  resume?: Partial<Record<string, ResumeCapability>>
  chat?: Partial<Record<string, Partial<ChatCapability>>>
}

/** `ctx.providers.capability` over the given per-provider capabilities. */
export function fakeProviders(caps: FakeCaps = {}) {
  return {
    capability: <K extends keyof CapabilityMap>(providerId: string, key: K): CapabilityMap[K] | undefined =>
      (caps as Record<string, Record<string, unknown> | undefined>)[key]?.[providerId] as CapabilityMap[K] | undefined,
  }
}

export const claudeResume = (): ResumeCapability => ({
  canResumeInChat: true,
  terminalResumeArgs: vi.fn(({ externalSessionId }) => ({ args: ['--resume', externalSessionId], env: {} })),
})

export const chatOk = (): Partial<ChatCapability> => ({ checkSupport: async () => ({ ok: true }) })

/** The real SDK main event bus with a silent logger. */
export const fakeEvents = () => createEventBus(silentLog())
