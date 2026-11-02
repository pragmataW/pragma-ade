import { describe, expect, it } from 'vitest'
import { compareSortKeys } from '../src/lib/order'
import { initialRanks, rankBetween, resolveRank } from '../src/lib/rank'

const KEYS = ['a0', 'a1', 'a2']

describe('resolveRank', () => {
  it('returns a key for an empty column', () => {
    expect(typeof resolveRank([], {})).toBe('string')
  })
  it('places after a neighbour, before the next key', () => {
    const k = resolveRank(KEYS, { afterKey: 'a0' })
    expect(k > 'a0' && k < 'a1').toBe(true)
  })
  it('places before the first key', () => {
    expect(resolveRank(KEYS, { beforeKey: 'a0' }) < 'a0').toBe(true)
  })
  it('appends by default', () => {
    expect(resolveRank(KEYS, {}) > 'a2').toBe(true)
  })
  it('accepts a bound key that is not in the column (other board)', () => {
    const k = resolveRank(['a0', 'a2'], { afterKey: 'a1' })
    expect(k > 'a1' && k < 'a2').toBe(true)
  })
  it('keeps 200 successive insertions after the first key distinct and ordered', () => {
    const keys = [rankBetween(null, null)]
    const first = keys[0] as string
    const inserted: string[] = []
    for (let i = 0; i < 200; i++) {
      const k = resolveRank([...keys, ...inserted], { afterKey: first })
      inserted.unshift(k)
    }
    const all = [first, ...inserted]
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort(compareSortKeys)).toEqual(all)
  })
})

it('initialRanks are strictly increasing', () => {
  const ranks = initialRanks(5)
  expect(ranks).toHaveLength(5)
  for (let i = 1; i < ranks.length; i++)
    expect(compareSortKeys(ranks[i - 1] as string, ranks[i] as string)).toBeLessThan(0)
})

it('compareSortKeys uses code-unit order', () => {
  expect(compareSortKeys('Z', 'a')).toBeLessThan(0)
  expect(compareSortKeys('a', 'a')).toBe(0)
  expect(compareSortKeys('b', 'a')).toBeGreaterThan(0)
})
