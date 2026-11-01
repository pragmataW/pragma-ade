import { readFileSync } from 'node:fs'
import { z } from 'zod'

declare function t(key: string): string
declare const fn: () => void
declare const arr: number[]
declare const v: unknown

const TIMEOUT_MS = 250
type K = 'a' | 'b'

export const first = readFileSync('settings.json')
export const second = readFileSync('settings.json')
setTimeout(fn, 250)
export const last = arr.at(-1)
export const schema = z.string()
export const k1 = t('core:x')
export const k2 = t('core:x')
export const k: K = 'a'
export const isString = typeof v === 'string'
export const isString2 = typeof v === 'string'
export const port = 8080 // lint-allow: literals — fixture exception
export { TIMEOUT_MS }
