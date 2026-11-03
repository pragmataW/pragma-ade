import { DAY_MS, HOUR_MS, MINUTE_MS } from '../../constants'

export const RELATIVE_TIME_KEYS = ['justNow', 'minutes', 'hours', 'days'] as const
export type RelativeTimeKey = (typeof RELATIVE_TIME_KEYS)[number]

const BUCKETS = [
  { key: 'days', ms: DAY_MS },
  { key: 'hours', ms: HOUR_MS },
  { key: 'minutes', ms: MINUTE_MS },
] as const satisfies readonly { key: RelativeTimeKey; ms: number }[]

/** `ts` relative to `now` as an i18n key (`comments:time.<key>`) and its count; the future reads as "just now". */
export function relativeTimeParts(ts: number, now: number): { key: RelativeTimeKey; count: number } {
  const age = now - ts
  for (const b of BUCKETS) if (age >= b.ms) return { key: b.key, count: Math.floor(age / b.ms) }
  return { key: 'justNow', count: 0 }
}
