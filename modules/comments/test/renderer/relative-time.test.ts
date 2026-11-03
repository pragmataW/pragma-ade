import { expect, test } from 'vitest'
import { relativeTimeParts } from '../../src/renderer/lib/relative-time'

const NOW = 1_000_000_000_000
const MIN = 60_000

test('relative time buckets: just now, minutes, hours, days', () => {
  expect(relativeTimeParts(NOW - 10_000, NOW)).toEqual({ key: 'justNow', count: 0 })
  expect(relativeTimeParts(NOW + 5_000, NOW)).toEqual({ key: 'justNow', count: 0 })
  expect(relativeTimeParts(NOW - MIN, NOW)).toEqual({ key: 'minutes', count: 1 })
  expect(relativeTimeParts(NOW - 59 * MIN, NOW)).toEqual({ key: 'minutes', count: 59 })
  expect(relativeTimeParts(NOW - 60 * MIN, NOW)).toEqual({ key: 'hours', count: 1 })
  expect(relativeTimeParts(NOW - 25 * 60 * MIN, NOW)).toEqual({ key: 'days', count: 1 })
})
