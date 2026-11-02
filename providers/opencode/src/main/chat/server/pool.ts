import { POOL_DISPOSED } from '../constants'

/** What the pool manages: something that can stop and that may exit on its own. */
export interface Pooled {
  stop(): Promise<void>
  onExit(cb: (code: number | null) => void): () => void
}

export interface Lease<T> {
  readonly resource: T
  /** Idempotent. */
  release(): void
}

interface Entry<T> {
  promise: Promise<T>
  resource?: T
  refs: number
  timer?: ReturnType<typeof setTimeout>
  unsubscribe?: () => void
}

export class PoolDisposedError extends Error {}

/**
 * Ref-counted, keyed resources: concurrent acquires share one in-flight create (a failure rejects them all and clears
 * the key); the last release starts an idle timer (an acquire during the grace reuses the resource); an exit evicts at
 * once; `disposeAll` stops everything, in-flight creates included, and rejects later acquires.
 */
export class ResourcePool<T extends Pooled> {
  readonly #entries = new Map<string, Entry<T>>()
  readonly #evicted = new Set<(key: string, resource: T) => void>()
  readonly #idleGraceMs: number
  #disposed = false

  constructor(o: { idleGraceMs: number }) {
    this.#idleGraceMs = o.idleGraceMs
  }

  async acquire(key: string, create: () => Promise<T>): Promise<Lease<T>> {
    if (this.#disposed) throw new PoolDisposedError(POOL_DISPOSED)
    const entry = this.#entries.get(key) ?? this.#create(key, create)
    entry.refs += 1
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = undefined
    let resource: T
    try {
      resource = await entry.promise
    } catch (e) {
      entry.refs -= 1
      throw e
    }
    return this.#lease(key, entry, resource)
  }

  refCount(key: string): number {
    return this.#entries.get(key)?.refs ?? 0
  }

  has(key: string): boolean {
    return this.#entries.has(key)
  }

  onEvicted(cb: (key: string, resource: T) => void): () => void {
    this.#evicted.add(cb)
    return () => this.#evicted.delete(cb)
  }

  async disposeAll(): Promise<void> {
    this.#disposed = true
    const entries = [...this.#entries.values()]
    this.#entries.clear()
    await Promise.allSettled(entries.map((e) => this.#stopEntry(e)))
  }

  #create(key: string, create: () => Promise<T>): Entry<T> {
    const entry: Entry<T> = { refs: 0, promise: Promise.resolve(undefined as unknown as T) }
    entry.promise = create().then(
      (resource) => this.#created(key, entry, resource),
      (e: unknown) => {
        if (this.#entries.get(key) === entry) this.#entries.delete(key)
        throw e
      },
    )
    this.#entries.set(key, entry)
    return entry
  }

  async #created(key: string, entry: Entry<T>, resource: T): Promise<T> {
    entry.resource = resource
    if (this.#disposed) {
      await resource.stop()
      throw new PoolDisposedError(POOL_DISPOSED)
    }
    entry.unsubscribe = resource.onExit(() => this.#evict(key, entry, resource))
    return resource
  }

  #evict(key: string, entry: Entry<T>, resource: T): void {
    if (entry.timer) clearTimeout(entry.timer)
    if (this.#entries.get(key) !== entry) return
    this.#entries.delete(key)
    for (const cb of this.#evicted) cb(key, resource)
  }

  #lease(key: string, entry: Entry<T>, resource: T): Lease<T> {
    let released = false
    return {
      resource,
      release: () => {
        if (released) return
        released = true
        entry.refs -= 1
        if (entry.refs > 0 || this.#entries.get(key) !== entry) return
        entry.timer = setTimeout(() => {
          if (entry.refs > 0 || this.#entries.get(key) !== entry) return
          this.#entries.delete(key)
          void this.#stopEntry(entry)
        }, this.#idleGraceMs)
      },
    }
  }

  async #stopEntry(entry: Entry<T>): Promise<void> {
    if (entry.timer) clearTimeout(entry.timer)
    entry.unsubscribe?.()
    const resource = entry.resource ?? (await entry.promise.catch(() => undefined))
    await resource?.stop()
  }
}
