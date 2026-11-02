import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..', '..', 'src', 'renderer')
const en = JSON.parse(readFileSync(join(import.meta.dirname, '..', '..', 'locales', 'en.json'), 'utf8'))
const KEY_RE = /'editor:([A-Za-z0-9_.]+)'/g
const PLURALS = ['_one', '_other']

const has = (path: string): boolean => {
  const value = path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], en)
  if (value !== undefined) return true
  return PLURALS.every((p) => has(`${path}${p}`))
}

describe('locales', () => {
  it('every editor:* key used in src/renderer exists in locales/en.json', () => {
    const keys = readdirSync(SRC)
      .filter((f) => /\.tsx?$/.test(f))
      .flatMap((f) => [...readFileSync(join(SRC, f), 'utf8').matchAll(KEY_RE)].map((m) => m[1] as string))
    expect(keys.length).toBeGreaterThan(10)
    expect(keys.filter((k) => !has(k))).toEqual([])
  })
})
