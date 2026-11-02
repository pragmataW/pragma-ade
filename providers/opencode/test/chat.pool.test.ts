import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PoolDisposedError, type Pooled, ResourcePool } from '../src/main/chat/server/pool'

const GRACE = 1000

/** A fake pooled resource that records stops and can "crash". */
function fakeResource(id: number) {
  const exits = new Set<(code: number | null) => void>()
  const r = {
    id,
    stops: 0,
    stop: async () => {
      r.stops += 1
    },
    onExit: (cb: (code: number | null) => void) => {
      exits.add(cb)
      return () => exits.delete(cb)
    },
    crash: () => {
      for (const cb of exits) cb(1)
    },
  }
  return r satisfies Pooled
}

function setup() {
  const pool = new ResourcePool<ReturnType<typeof fakeResource>>({ idleGraceMs: GRACE })
  let n = 0
  const created: ReturnType<typeof fakeResource>[] = []
  const create = vi.fn(async () => {
    const r = fakeResource(++n)
    created.push(r)
    return r
  })
  return { pool, create, created }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('ResourcePool', () => {
  it('concurrent acquire spawns once', async () => {
    const { pool, create } = setup()
    const [a, b] = await Promise.all([pool.acquire('k', create), pool.acquire('k', create)])
    expect(create).toHaveBeenCalledTimes(1)
    expect(a.resource).toBe(b.resource)
    expect(pool.refCount('k')).toBe(2)
  })

  it('stops after last release + grace; re-acquire within grace reuses', async () => {
    const { pool, create, created } = setup()
    const a = await pool.acquire('k', create)
    a.release()
    a.release()
    expect(pool.refCount('k')).toBe(0)
    await vi.advanceTimersByTimeAsync(GRACE / 2)
    const b = await pool.acquire('k', create)
    expect(b.resource).toBe(a.resource)
    expect(create).toHaveBeenCalledTimes(1)
    b.release()
    await vi.advanceTimersByTimeAsync(GRACE)
    expect(created[0]?.stops).toBe(1)
    expect(pool.has('k')).toBe(false)
  })

  it('pool evicts crashed server and restarts on next acquire', async () => {
    const { pool, create, created } = setup()
    const evicted = vi.fn()
    pool.onEvicted(evicted)
    const a = await pool.acquire('k', create)
    created[0]?.crash()
    expect(pool.has('k')).toBe(false)
    expect(evicted).toHaveBeenCalledWith('k', a.resource)
    a.release()
    const b = await pool.acquire('k', create)
    expect(b.resource).not.toBe(a.resource)
    expect(create).toHaveBeenCalledTimes(2)
  })

  it('failed create rejects all waiters and clears key', async () => {
    const { pool } = setup()
    const failing = vi.fn(async () => {
      throw new Error('boom')
    })
    const results = await Promise.allSettled([pool.acquire('k', failing), pool.acquire('k', failing)])
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected'])
    expect(failing).toHaveBeenCalledTimes(1)
    expect(pool.has('k')).toBe(false)
  })

  it('disposeAll stops in-flight creates and rejects later acquires', async () => {
    const { pool, create, created } = setup()
    const live = await pool.acquire('a', create)
    let finish: (r: ReturnType<typeof fakeResource>) => void = () => undefined
    const slow = () => new Promise<ReturnType<typeof fakeResource>>((r) => (finish = r))
    const inFlight = pool.acquire('b', slow)
    const disposed = pool.disposeAll()
    const late = fakeResource(99)
    finish(late)
    await expect(inFlight).rejects.toBeInstanceOf(PoolDisposedError)
    await disposed
    expect(created[0]?.stops).toBe(1)
    expect(late.stops).toBe(1)
    expect(live.resource.stops).toBe(1)
    await expect(pool.acquire('c', create)).rejects.toBeInstanceOf(PoolDisposedError)
  })
})
