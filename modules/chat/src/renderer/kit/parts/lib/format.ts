import { FORMAT_LOCALE, MS_PER_SECOND } from '../../../../constants'

// The app's locale (v1 ships English only), never the system locale: "18.4K tokens", not "18,4 B tokens".
const TOKENS = new Intl.NumberFormat(FORMAT_LOCALE, { notation: 'compact', maximumFractionDigits: 1 })
const USD = new Intl.NumberFormat(FORMAT_LOCALE, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const COUNT = new Intl.NumberFormat(FORMAT_LOCALE)
const SECONDS = new Intl.NumberFormat(FORMAT_LOCALE, { maximumFractionDigits: 1 })
const TIME = new Intl.DateTimeFormat(FORMAT_LOCALE, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

/** 12.3K */
export const formatTokens = (n: number): string => TOKENS.format(n)
/** 48,000 */
export const formatCount = (n: number): string => COUNT.format(n)
/** $0.0123 */
export const formatUsd = (n: number): string => USD.format(n)
/** 2.5 (seconds, for "retrying in {{seconds}}s") */
export const formatSeconds = (ms: number): string => SECONDS.format(ms / MS_PER_SECOND)
/** 14:05 (local clock time of an epoch-ms instant, 24-hour) */
export const formatClock = (epochMs: number): string => TIME.format(epochMs)
