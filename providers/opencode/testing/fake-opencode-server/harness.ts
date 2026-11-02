/** Shared helpers for every OpenCode chat test (fake `opencode serve`, contexts, emits, locales). Test code only. */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AgentProfile } from '@pragma/module-agents/contract'
import { aProfile } from '@pragma/module-agents/testing'
import type { ChatEvent, ChatSessionContext } from '@pragma/module-chat/contract'

export const FAKE_DIR = import.meta.dirname
export const BIN = join(FAKE_DIR, 'bin.mjs')
export const SCENARIOS = ['basic', 'form-retry', 'long-turn'] as const
export type ScenarioName = (typeof SCENARIOS)[number]
export const scenarioPath = (name: ScenarioName): string => join(FAKE_DIR, 'scenarios', `${name}.json`)
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
