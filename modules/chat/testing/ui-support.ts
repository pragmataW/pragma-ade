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
  type ComposerEntry,
  type ComposerInboxChanged,
  chatSettingsDefaults,
} from '../src/contract'
import { makeTranscript, TEST_SESSION_ID } from './support'

const ROOT = join(import.meta.dirname, '..', '..', '..')
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
type Tree = Record<string, unknown>
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null && !Array.isArray(v)
const deepMerge = (a: Tree, b: Tree): Tree =>
  Object.fromEntries(
    [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => {
      const [x, y] = [a[k], b[k]]
      return [k, isTree(x) && isTree(y) ? deepMerge(x, y) : (y ?? x)]
    }),
  )
/** A provider's per-capability locale files, deep-merged like the generator does. */
const providerLocales = (id: string): Tree => {
  const dir = join(ROOT, 'providers', id, 'locales', 'en')
  return readdirSync(dir)
    .map((f) => readJson(join(dir, f)))
    .reduce(deepMerge, {})
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
  /** Queues an entry in the stub's composer inbox and notifies `onComposerInboxChanged` listeners. */
  pushInbox(sessionId: string, entry: ComposerEntry): void
  snapshots: Map<string, ChatSnapshotDto>
  currentSettings: ChatSettings
}

/** A `ChatHost` that records every action and lets tests push events. */
export function stubChatHost(over: Partial<ChatHost> & { files?: string[] } = {}): StubChatHost {
  const eventCbs = new Set<(env: ChatEventEnvelope) => void>()
  const inboxCbs = new Set<(p: ComposerInboxChanged) => void>()
  const inbox = new Map<string, ComposerEntry[]>()
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
    onComposerInboxChanged: subscribe(inboxCbs),
    async takeComposerInbox(sessionId) {
      const taken = inbox.get(sessionId) ?? []
      inbox.delete(sessionId)
      return taken
    },
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
    commands: {
      has: () => false,
      execute: record('executeCommand', undefined),
      onChange: () => ({ dispose: () => undefined }),
    },
    theme: { get: () => 'dark', subscribe: () => ({ dispose: () => undefined }) },
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
    pushInbox: (sessionId, entry) => {
      inbox.set(sessionId, [...(inbox.get(sessionId) ?? []), entry])
      for (const cb of inboxCbs) cb({ sessionId })
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

/** jsdom has no layout: viewport-sized boxes (so the virtualized list renders a window) and a no-op ResizeObserver. */
export function installJsdomLayout(box = { width: 740, height: 800 }): void {
  const g = globalThis as unknown as { HTMLElement: { prototype: object }; ResizeObserver?: unknown }
  for (const [prop, value] of [
    ['offsetWidth', box.width],
    ['offsetHeight', box.height],
    ['clientHeight', box.height],
  ] as const)
    Object.defineProperty(g.HTMLElement.prototype, prop, { configurable: true, get: () => value })
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
