import { describe, expect, it } from 'vitest'
import { KeyedMutex } from '../src/main/lib/keyed-mutex'

const tick = () => new Promise((r) => setTimeout(r, 5))
function recorder() {
  const log: string[] = []
  const job = (name: string) => async () => {
    log.push(`${name}-start`)
    await tick()
    log.push(`${name}-end`)
  }
  return { log, job }
}

describe('KeyedMutex', () => {
  it('runs the same key FIFO, one at a time', async () => {
    const m = new KeyedMutex()
    const { log, job } = recorder()
    await Promise.all([m.run('a', job('a1')), m.run('a', job('a2'))])
    expect(log).toEqual(['a1-start', 'a1-end', 'a2-start', 'a2-end'])
  })

  it('runs different keys in parallel', async () => {
    const m = new KeyedMutex()
    const { log, job } = recorder()
    await Promise.all([m.run('a', job('a')), m.run('b', job('b'))])
    expect(log.slice(0, 2).sort()).toEqual(['a-start', 'b-start'])
  })

  it('continues the queue after a rejection and returns values', async () => {
    const m = new KeyedMutex()
    const failed = m.run('a', async () => {
      throw new Error('boom')
    })
    const next = m.run('a', async () => 42)
    await expect(failed).rejects.toThrow('boom')
    await expect(next).resolves.toBe(42)
  })
})
