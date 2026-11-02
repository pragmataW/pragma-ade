import { describe, expect, it } from 'vitest'
import { Lru } from '../src/main/views/lru'

describe('Lru', () => {
  it('touch 5 keys with max 4 evicts the oldest', () => {
    const lru = new Lru<string>(4)
    const evicted = ['a', 'b', 'c', 'd', 'e'].flatMap((k) => lru.touch(k))
    expect(evicted).toEqual(['a'])
    expect(lru.keys()).toEqual(['e', 'd', 'c', 'b'])
  })

  it('touching an existing key moves it to MRU, no eviction', () => {
    const lru = new Lru<string>(3)
    for (const k of ['a', 'b', 'c']) lru.touch(k)
    expect(lru.touch('a')).toEqual([])
    expect(lru.keys()).toEqual(['a', 'c', 'b'])
  })

  it('setMax(2) returns evicted LRU keys', () => {
    const lru = new Lru<string>(4)
    for (const k of ['a', 'b', 'c', 'd']) lru.touch(k)
    expect(lru.setMax(2)).toEqual(['b', 'a'])
    expect(lru.has('a')).toBe(false)
  })

  it('delete removes a key', () => {
    const lru = new Lru<string>(2)
    lru.touch('a')
    lru.delete('a')
    expect(lru.keys()).toEqual([])
  })
})
