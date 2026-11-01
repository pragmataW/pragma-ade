/** Renderer test builders: a recording `ChatHost`, a `ChatSessionApi` over a transcript and an English i18n instance. */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import i18next, { type i18n } from 'i18next'
import { initReactI18next } from 'react-i18next'
import {
  type ChatEvent,
  type ChatEventEnvelope,
  type ChatHost,
  type ChatSessionApi,
  type ChatSessionStatus,
  type ChatSettings,
  type ChatSnapshotDto,
  type ComposerAppend,
  chatSettingsDefaults,
} from '../src/contract'
import { makeTranscript, TEST_SESSION_ID } from './support'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
const providerLocales = (id: string) => {
  const dir = join(ROOT, 'providers', id, 'locales', 'en')
  return Object.assign({}, ...readdirSync(dir).map((f) => readJson(join(dir, f))))
}

/** English `chat` namespace plus the given providers' namespaces. */
export async function chatTestI18n(providers: string[] = []): Promise<i18n> {
  const instance = i18next.createInstance()
  const extra = Object.fromEntries(providers.map((p) => [p, providerLocales(p)]))
  await instance.use(initReactI18next).init({
    lng: 'en',
    resources: { en: { chat: readJson(join(ROOT, 'modules', 'chat', 'locales', 'en.json')), ...extra } },
    interpolation: { escapeValue: false },
  })
  return instance
}

type Call = { method: string; args: unknown[] }

const NoMark = (): null => null

export interface StubChatHost extends ChatHost {
  calls: Call[]
  emitEvent(env: ChatEventEnvelope): void
  emitAppend(p: ComposerAppend): void
  snapshots: Map<string, ChatSnapshotDto>
  currentSettings: ChatSettings
}

/** A `ChatHost` that records every action and lets tests push events. */
export function stubChatHost(over: Partial<ChatHost> & { files?: string[] } = {}): StubChatHost {
  const eventCbs = new Set<(env: ChatEventEnvelope) => void>()
  const appendCbs = new Set<(p: ComposerAppend) => void>()
  const settingsCbs = new Set<() => void>()
  const calls: Call[] = []
  const record =
    <R>(method: string, result: R) =>
    async (...args: unknown[]) => {
      calls.push({ method, args })
      return result
    }
  const subscribe =
    <T>(set: Set<T>) =>
    (cb: T) => {
      set.add(cb)
      return { dispose: () => void set.delete(cb) }
    }
  const host: StubChatHost = {
    calls,
    snapshots: new Map(),
    currentSettings: { ...chatSettingsDefaults },
    async open(sessionId) {
      calls.push({ method: 'open', args: [sessionId] })
      return host.snapshots.get(sessionId) ?? { providerId: 'fake', transcript: makeTranscript([]), status: 'idle' }
    },
    onEvent: subscribe(eventCbs),
    onComposerAppend: subscribe(appendCbs),
    send: record('send', { queued: false }),
    interrupt: record('interrupt', undefined),
    cancelQueued: record('cancelQueued', undefined),
    respondPermission: record('respondPermission', undefined),
    respond: record('respond', undefined),
    setOption: record('setOption', undefined),
    async searchFiles(sessionId, query) {
      calls.push({ method: 'searchFiles', args: [sessionId, query] })
      return (over.files ?? []).filter((f) => f.includes(query))
    },
    checkSupport: record('checkSupport', { ok: true }),
    chatUi: () => undefined,
    providerName: (id) => `Provider ${id}`,
    ProviderMark: NoMark,
    StatusIcon: null,
    openExternal: (url) => void calls.push({ method: 'openExternal', args: [url] }),
    settings: {
      get: () => host.currentSettings,
      async update(patch) {
        calls.push({ method: 'updateSettings', args: [patch] })
        host.currentSettings = { ...host.currentSettings, ...patch }
        for (const cb of settingsCbs) cb()
      },
      subscribe: subscribe(settingsCbs),
    },
    emitEvent: (env) => {
      for (const cb of eventCbs) cb(env)
    },
    emitAppend: (p) => {
      for (const cb of appendCbs) cb(p)
    },
    ...over,
  }
  return host
}

export const callsOf = (host: StubChatHost, method: string) => host.calls.filter((c) => c.method === method)

/** A `ChatSessionApi` over the transcript of `events`, recording actions in `calls`. */
export function stubSessionApi(
  events: ChatEvent[] = [],
  over: Partial<ChatSessionApi> & { status?: ChatSessionStatus; files?: string[] } = {},
) {
  const calls: Call[] = []
  const rec =
    <R>(method: string, result: R) =>
    async (...args: unknown[]) => {
      calls.push({ method, args })
      return result
    }
  const api: ChatSessionApi = {
    sessionId: TEST_SESSION_ID,
    providerId: 'fake',
    transcript: makeTranscript(events),
    status: over.status ?? 'idle',
    send: rec('send', { queued: false }),
    interrupt: rec('interrupt', undefined),
    cancelQueued: rec('cancelQueued', undefined),
    respondPermission: rec('respondPermission', undefined),
    respond: rec('respond', undefined),
    setOption: rec('setOption', undefined),
    async searchFiles(query) {
      calls.push({ method: 'searchFiles', args: [query] })
      return (over.files ?? []).filter((f) => f.includes(query))
    },
    ...over,
  }
  return { api, calls, callsOf: (method: string) => calls.filter((c) => c.method === method) }
}
