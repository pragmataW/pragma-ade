import type { Logger } from '@pragma/sdk'
import { CONSUMED_EVENT_TYPES, EV, OTHER_EVENT } from '../constants'
import { parseV2Event, type V2Event } from '../schemas'
import type { WireClient } from './client'

export type HubEvent = Exclude<V2Event, { type: typeof OTHER_EVENT }>
type Listener = (e: HubEvent) => void

/** The session an event belongs to (`data.sessionID`, or the form's for `form.created`). */
export function sessionOf(e: HubEvent): string | undefined {
  const data = e.data as { sessionID?: string; form?: { sessionID?: string } }
  return data.sessionID ?? data.form?.sessionID
}

/**
 * One SSE loop per server (`event.subscribe`), reopened `reconnectMs` after a drop. v2 streams are volatile, so every
 * `server.connected` after the first fires `onReconnect` (sessions then resync). Events fan out by session id.
 */
export class EventHub {
  readonly #client: Pick<WireClient, 'event'>
  readonly #reconnectMs: number
  readonly #log: Pick<Logger, 'warn'>
  readonly #listeners = new Map<string, Set<Listener>>()
  readonly #reconnectCbs = new Set<() => void>()
  readonly #ac = new AbortController()
  #connections = 0
  #closed = false
  #markReady: () => void = () => undefined
  readonly #ready = new Promise<void>((r) => {
    this.#markReady = r
  })

  constructor(client: Pick<WireClient, 'event'>, o: { reconnectMs: number; log: Pick<Logger, 'warn'> }) {
    this.#client = client
    this.#reconnectMs = o.reconnectMs
    this.#log = o.log
  }

  /** Resolves once the first stream is connected (events sent before that would be lost). */
  ready(): Promise<void> {
    return this.#ready
  }

  start(): void {
    void this.#loop()
  }

  subscribe(sessionId: string, cb: Listener): () => void {
    const set = this.#listeners.get(sessionId) ?? new Set<Listener>()
    set.add(cb)
    this.#listeners.set(sessionId, set)
    return () => {
      set.delete(cb)
      if (set.size === 0) this.#listeners.delete(sessionId)
    }
  }

  onReconnect(cb: () => void): () => void {
    this.#reconnectCbs.add(cb)
    return () => this.#reconnectCbs.delete(cb)
  }

  close(): void {
    this.#closed = true
    this.#ac.abort()
  }

  async #loop(): Promise<void> {
    while (!this.#closed) {
      try {
        const stream = this.#client.event.subscribe({ types: CONSUMED_EVENT_TYPES, signal: this.#ac.signal })
        for await (const raw of stream) this.#dispatch(raw)
      } catch (e) {
        if (!this.#closed) this.#log.warn('opencode event stream dropped', e)
      }
      if (!this.#closed) await new Promise((r) => setTimeout(r, this.#reconnectMs))
    }
  }

  #dispatch(raw: unknown): void {
    const e = parseV2Event(raw)
    if (!e || e.type === OTHER_EVENT) return
    if (e.type === EV.connected) {
      this.#connected()
      return
    }
    const sid = sessionOf(e)
    for (const cb of (sid && this.#listeners.get(sid)) || []) cb(e)
  }

  #connected(): void {
    this.#connections += 1
    if (this.#connections === 1) this.#markReady()
    else for (const cb of this.#reconnectCbs) cb()
  }
}
