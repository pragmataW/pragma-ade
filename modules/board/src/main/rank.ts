import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing'
import { compareSortKeys } from '../lib/order'

/** A fractional key strictly between `lo` and `hi` (null = open end). */
export const rankBetween = (lo: string | null, hi: string | null): string => generateKeyBetween(lo, hi)

/** `n` increasing keys for a fresh list. */
export const initialRanks = (n: number): string[] => generateNKeysBetween(null, null, n)

/**
 * The key for an item placed after `afterKey` (else before `beforeKey`, else at the end) among `columnKeys` (the
 * target column without the moving item, any order). The bound only has to be comparable, so it may belong to a
 * hidden card or to another board's column (All-projects view).
 */
export function resolveRank(columnKeys: string[], bounds: { afterKey?: string; beforeKey?: string }): string {
  const sorted = [...columnKeys].sort(compareSortKeys)
  const { afterKey, beforeKey } = bounds
  if (afterKey !== undefined) return rankBetween(afterKey, sorted.find((k) => compareSortKeys(k, afterKey) > 0) ?? null)
  if (beforeKey !== undefined)
    return rankBetween(sorted.findLast((k) => compareSortKeys(k, beforeKey) < 0) ?? null, beforeKey)
  return rankBetween(sorted.at(-1) ?? null, null)
}
