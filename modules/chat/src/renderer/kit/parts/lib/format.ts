import { MS_PER_SECOND } from '../../../../constants'

const TOKENS = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 })
const USD = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 })
const SECONDS = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })
const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' })

/** 12.3K */
export const formatTokens = (n: number): string => TOKENS.format(n)
/** $0.0123 */
export const formatUsd = (n: number): string => USD.format(n)
/** 2.5 (seconds, for "retrying in {{seconds}}s") */
export const formatSeconds = (ms: number): string => SECONDS.format(ms / MS_PER_SECOND)
/** 14:05 (local clock time of an epoch-ms instant) */
export const formatClock = (epochMs: number): string => TIME.format(epochMs)
