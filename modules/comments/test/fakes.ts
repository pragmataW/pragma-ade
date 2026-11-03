/** Shared unit-test fakes (§9: no copy-pasted setup). */
import type { AgentSessionStartedPayload } from '@pragma/module-agents/contract'
import { ProjectsRendererServiceToken, type ProjectsSnapshot, type Worktree } from '@pragma/module-projects/contract'
import type { MainIpcApi } from '@pragma/sdk/main'
import type { RendererContext, SettingsPage, SlotEntry } from '@pragma/sdk/renderer'
import type { IpcClient } from '@pragma/sdk/runtime/renderer'
import { COMMENT_STATUS_FILTER, type Comment, type CommentsSettings, commentsIpc } from '../src/contract'
import type { CommentsUpstream, SessionRef } from '../src/main/upstream'
import { setRuntime } from '../src/renderer/runtime'
import { useCommentsStore } from '../src/renderer/store'
import { WT } from './factories'

type Listener<A> = (a: A) => void

/** A tiny listener set: `on` returns unsubscribe. */
export function listeners<A>() {
  const set = new Set<Listener<A>>()
  return {
    on(cb: Listener<A>) {
      set.add(cb)
      return () => void set.delete(cb)
    },
    emit: (a: A) => {
      for (const cb of [...set]) cb(a)
    },
    get size() {
      return set.size
    },
  }
}

/** A recording `CommentsUpstream` over a mutable session list; bracketed paste is on unless a pty is listed off. */
export function createFakeUpstream(initial: SessionRef[] = []) {
  const sessions = [...initial]
  const pasted: [string, string][] = []
  const written: [string, string][] = []
  const published: [string, unknown][] = []
  const order: string[] = []
  const bracketedOff = new Set<string>()
  let lastFocusedId: string | undefined
  const started = listeners<AgentSessionStartedPayload>()
  const removed = listeners<string>()
  const data = new Map<string, ReturnType<typeof listeners<void>>>()
  const dataOf = (ptyId: string) => data.get(ptyId) ?? data.set(ptyId, listeners<void>()).get(ptyId)
  const upstream: CommentsUpstream = {
    listSessions: async (worktreeId) => sessions.filter((s) => s.worktreeId === worktreeId),
    getSession: async (id) => sessions.find((s) => s.id === id),
    lastFocusedSession: async (worktreeId) =>
      sessions.find((s) => s.id === lastFocusedId && s.worktreeId === worktreeId),
    paste(ptyId, text) {
      pasted.push([ptyId, text])
      order.push('paste')
    },
    isBracketedPasteEnabled: (ptyId) => !bracketedOff.has(ptyId),
    write(ptyId, d) {
      written.push([ptyId, d])
      order.push('write')
    },
    onPtyData: (ptyId, cb) => dataOf(ptyId)?.on(cb) ?? (() => undefined),
    onSessionStarted: (cb) => started.on(cb),
    onWorktreeRemoved: (cb) => removed.on(cb),
    publish: (contract, payload) => void published.push([contract.channel, payload]),
  }
  return Object.assign(upstream, {
    sessions,
    pasted,
    written,
    published,
    order,
    bracketedOff,
    setLastFocused: (id: string | undefined) => {
      lastFocusedId = id
    },
    emitSessionStarted: (e: AgentSessionStartedPayload) => started.emit(e),
    emitWorktreeRemoved: (id: string) => removed.emit(id),
    emitPtyData: (ptyId: string) => dataOf(ptyId)?.emit(),
    publishedOn: (channel: string) => published.filter(([c]) => c === channel).map(([, p]) => p),
  })
}
export type FakeUpstream = ReturnType<typeof createFakeUpstream>

type Handler = (input: unknown, meta: unknown) => unknown
type Contract = { channel: string; input?: { parse(v: unknown): unknown } }

/**
 * Both IPC sides in one fake: main `handle` registers handlers; renderer `invoke` runs a handler, else a scripted
 * response (`respond`); `subscribe`/`emit` stand in for main → renderer events. `calls` records every invoke.
 */
export function createFakeIpc() {
  const handlers = new Map<string, Handler>()
  const scripted = new Map<string, (input: unknown) => unknown>()
  const subs = new Map<string, Set<(p: unknown) => void>>()
  const calls: [string, unknown][] = []
  const fake = {
    handlers,
    calls,
    callsOn: (channel: string) => calls.filter(([c]) => c === channel).map(([, i]) => i),
    handle(c: Contract, h: Handler) {
      handlers.set(c.channel, h)
      return { dispose: () => void handlers.delete(c.channel) }
    },
    respond(c: Contract, fn: (input: unknown) => unknown) {
      scripted.set(c.channel, fn)
    },
    async invoke(c: Contract, input: unknown): Promise<never> {
      calls.push([c.channel, input])
      const h = handlers.get(c.channel)
      if (h) return (await h(c.input ? c.input.parse(input) : input, {})) as never
      const fn = scripted.get(c.channel)
      return (fn ? await fn(input) : undefined) as never
    },
    subscribe(c: Contract, cb: (p: unknown) => void) {
      const set = subs.get(c.channel) ?? new Set()
      subs.set(c.channel, set)
      set.add(cb)
      return { dispose: () => void set.delete(cb) }
    },
    emit(c: Contract, payload: unknown) {
      for (const cb of [...(subs.get(c.channel) ?? [])]) cb(payload)
    },
  }
  return fake as Omit<typeof fake, keyof Typed> & Typed
}
type Typed = { handle: MainIpcApi['handle']; invoke: IpcClient['invoke']; subscribe: IpcClient['subscribe'] }
export type FakeIpc = ReturnType<typeof createFakeIpc>

/** The projects renderer service with a settable active worktree. */
export function createFakeProjects(activeId: string | null = null) {
  let active = activeId
  const changes = listeners<void>()
  return {
    getActiveWorktree: () => (active ? ({ id: active } as Worktree) : null),
    getSnapshot: () => ({}) as ProjectsSnapshot,
    selectWorktree: async (id: string | null) => {
      active = id
      changes.emit()
    },
    subscribe: (cb: () => void) => changes.on(cb),
    setActive(id: string | null) {
      active = id
      changes.emit()
    },
  }
}

/**
 * A `RendererContext` subset for the comments renderer: fake IPC, a recording command registry, a services map
 * (projects renderer service pre-provided), recording slots / settings pages and an in-memory settings section.
 */
export function createFakeRendererCtx(opts: { activeWorktreeId?: string | null } = {}) {
  const ipc = createFakeIpc()
  const projects = createFakeProjects(opts.activeWorktreeId ?? null)
  const provided = new Map<string, unknown>([[ProjectsRendererServiceToken.id, projects]])
  const commandHandlers = new Map<string, (args: unknown) => unknown>()
  const executed: [string, unknown][] = []
  const slots: [string, SlotEntry<never>][] = []
  const pages: SettingsPage[] = []
  let settings: CommentsSettings = { submitAfterPaste: false }
  const settingsSubs = listeners<CommentsSettings>()
  const updates: unknown[] = []
  /** Every SDK confirm dialog; `confirmAnswer.value` is what the user picks. */
  const confirms: unknown[] = []
  const confirmAnswer = { value: true }
  const disposable = { dispose: () => undefined }
  const recording =
    <A extends unknown[]>(record: (...a: A) => void) =>
    (...a: A) => {
      record(...a)
      return disposable
    }
  const opened: string[] = []
  const commandsChanged = listeners<undefined>()
  const ctx = {
    ipc,
    shell: { openExternal: async (url: string) => void opened.push(url) },
    dialogs: {
      confirm: async (o: unknown) => {
        confirms.push(o)
        return confirmAnswer.value
      },
    },
    services: {
      provide: recording((token: { id: string }, impl: unknown) => void provided.set(token.id, impl)),
      get: (token: { id: string }) => provided.get(token.id),
      tryGet: (token: { id: string }) => provided.get(token.id),
    },
    commands: {
      register: (id: string | { id: string }, handler: (args: unknown) => unknown) => {
        commandHandlers.set(typeof id === 'string' ? id : id.id, handler)
        commandsChanged.emit(undefined)
        return disposable
      },
      onChange: (cb: () => void) => ({ dispose: commandsChanged.on(cb) }),
      execute: async (id: string, args?: unknown) => {
        executed.push([id, args])
        return commandHandlers.get(id)?.(args)
      },
      has: (id: string) => commandHandlers.has(id),
    },
    slots: { register: recording((slotId: string, e: SlotEntry<never>) => void slots.push([slotId, e])) },
    settingsPages: { register: recording((p: SettingsPage) => void pages.push(p)) },
    settings: {
      get: () => settings,
      set: async (v: CommentsSettings) => {
        settings = v
        settingsSubs.emit(v)
        return v
      },
      update: async (patch: Partial<CommentsSettings>) => {
        updates.push(patch)
        settings = { ...settings, ...patch }
        settingsSubs.emit(settings)
        return settings
      },
      subscribe: (cb: (v: CommentsSettings) => void) => ({ dispose: settingsSubs.on(cb) }),
      read: () => undefined,
    },
  }
  return Object.assign(ctx as unknown as RendererContext<CommentsSettings>, {
    fakeIpc: ipc,
    projects,
    provided,
    executed,
    slotEntries: slots,
    pagesRegistered: pages,
    updates,
    confirms,
    confirmAnswer,
    opened,
  })
}
export type FakeRendererCtx = ReturnType<typeof createFakeRendererCtx>

const matchesStatus = (c: Comment, status: string | undefined) =>
  !status || status === COMMENT_STATUS_FILTER.all || c.status === status

/**
 * The renderer runtime over a fake context with a fresh store; `list` answers from `data` (threads and round).
 * Call `init()` to start the store's subscriptions (disposed by `stop`).
 */
export function mountRenderer(opts: { activeWorktreeId?: string | null; threads?: Comment[]; round?: number } = {}) {
  const ctx = createFakeRendererCtx({
    activeWorktreeId: opts.activeWorktreeId === undefined ? WT : opts.activeWorktreeId,
  })
  const data = { threads: opts.threads ?? [], round: opts.round ?? 0 }
  ctx.fakeIpc.respond(commentsIpc.list, (input) => ({
    round: data.round,
    threads: data.threads.filter((c) => matchesStatus(c, (input as { status?: string }).status)),
  }))
  setRuntime(ctx)
  useCommentsStore.setState(useCommentsStore.getInitialState(), true)
  let off: (() => void) | undefined
  return Object.assign(ctx, {
    data,
    store: useCommentsStore,
    init() {
      off = useCommentsStore.getState().init()
    },
    stop() {
      off?.()
      setRuntime(undefined)
    },
  })
}
export type MountedRenderer = ReturnType<typeof mountRenderer>
