/** Shared unit-test fakes (§9: no copy-pasted setup). */
import type { AgentSessionStartedPayload } from '@pragma/module-agents/contract'
import type { MainIpcApi } from '@pragma/sdk/main'
import type { IpcClient } from '@pragma/sdk/runtime/renderer'
import type { CommentsUpstream, SessionRef } from '../src/main/upstream'

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
