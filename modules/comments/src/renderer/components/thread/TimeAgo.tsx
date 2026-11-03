import { useT } from '@pragma/sdk/renderer'
import { useEffect, useState } from 'react'
import { TIME_TICK_MS } from '../../../constants'
import { COMMENTS_TESTIDS as T } from '../../../contract'
import { type RelativeTimeKey, relativeTimeParts } from '../../lib/relative-time'

const TIME_KEYS = {
  justNow: 'comments:time.justNow',
  minutes: 'comments:time.minutes',
  hours: 'comments:time.hours',
  days: 'comments:time.days',
} as const satisfies Record<RelativeTimeKey, string>

const ABSOLUTE = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** "5m ago" (re-rendered while shown); the absolute date and time is the tooltip. */
export function TimeAgo({ ts }: { ts: number }) {
  const t = useT()
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TIME_TICK_MS)
    return () => clearInterval(id)
  }, [])
  const { key, count } = relativeTimeParts(ts, now)
  return (
    <time
      data-testid={T.threadTime}
      dateTime={new Date(ts).toISOString()}
      title={ABSOLUTE.format(ts)}
      className="shrink-0 text-[11px] text-muted-foreground tabular-nums"
    >
      {t(TIME_KEYS[key], { count })}
    </time>
  )
}
