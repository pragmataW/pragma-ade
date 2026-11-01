import { existsSync } from 'node:fs'
import { relative } from 'node:path'
import * as parcel from '@parcel/watcher'
import { type Debounced, debounce, type Logger } from '@pragma/sdk'
import { PARENT_PREFIX, POSIX_SEP, WINDOWS_SEP_RE } from '../constants'

export type OnBatch = (relPaths: string[], truncated: boolean) => void
type Subscribe = typeof parcel.subscribe

export interface FsWatcherOptions {
  debounceMs: number
  maxPaths: number
  subscribe?: Subscribe
  log?: Logger
}

interface Entry {
  ready: Promise<parcel.AsyncSubscription | null>
  flush: Debounced<[]>
  closed: boolean
}

const toPosix = (p: string): string => p.replace(WINDOWS_SEP_RE, POSIX_SEP)

/** Debounced directory subscriptions keyed by caller ids; used for worktrees and repo git dirs alike. */
export class FsWatcher {
  readonly #opts: FsWatcherOptions
  readonly #entries = new Map<string, Entry>()
  #closed = false

  constructor(opts: FsWatcherOptions) {
    this.#opts = opts
  }

  /** Idempotent per key; resolves once the subscription is live. A missing dir or a subscribe failure is logged, never thrown; after `closeAll` it is a no-op. */
  async watch(key: string, dir: string, ignore: readonly string[], onBatch: OnBatch): Promise<void> {
    if (this.#closed) return
    if (this.#entries.has(key)) {
      await this.#entries.get(key)?.ready
      return
    }
    if (!existsSync(dir)) {
      this.#opts.log?.warn(`not watching missing dir ${dir}`)
      return
    }
    const pending = new Set<string>()
    const flush = debounce(() => {
      const all = [...pending]
      pending.clear()
      if (all.length > 0) onBatch(all.slice(0, this.#opts.maxPaths), all.length > this.#opts.maxPaths)
    }, this.#opts.debounceMs)
    const entry: Entry = { flush, closed: false, ready: Promise.resolve(null) }
    const subscribe = this.#opts.subscribe ?? parcel.subscribe
    entry.ready = subscribe(
      dir,
      (error, events) => {
        if (error) this.#opts.log?.warn(`watch error in ${dir}`, error)
        if (entry.closed) return
        for (const e of events) {
          const rel = toPosix(relative(dir, e.path))
          // FSEvents may replay the watched dir itself (empty relative path) or report outside paths.
          if (rel && !rel.startsWith(PARENT_PREFIX)) pending.add(rel)
        }
        if (pending.size > 0) flush()
      },
      { ignore: [...ignore] },
    ).catch((error: unknown) => {
      this.#opts.log?.warn(`cannot watch ${dir}`, error)
      return null
    })
    this.#entries.set(key, entry)
    await entry.ready
  }

  async unwatch(key: string): Promise<void> {
    const entry = this.#entries.get(key)
    if (!entry) return
    this.#entries.delete(key)
    entry.closed = true
    entry.flush.cancel()
    const sub = await entry.ready
    await sub?.unsubscribe().catch((error: unknown) => this.#opts.log?.warn(`unwatch ${key} failed`, error))
  }

  has(key: string): boolean {
    return this.#entries.has(key)
  }

  /** Unwatches everything and refuses new subscriptions (module deactivate). */
  async closeAll(): Promise<void> {
    this.#closed = true
    await Promise.all([...this.#entries.keys()].map((key) => this.unwatch(key)))
  }
}
