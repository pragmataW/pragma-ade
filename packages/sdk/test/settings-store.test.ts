import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import { ProviderSettingsSchema } from '../src/common/providers'
import { SettingsStore, SettingsValidationError } from '../src/runtime/main/settings-store'
import { memoryLogger, tempDir } from './lib/builders'

const Section = {
  schema: z.object({ mode: z.enum(['a', 'b']), size: z.number() }),
  defaults: { mode: 'a' as const, size: 1 },
}

function withStore(contents?: unknown) {
  const dir = tempDir()
  const file = join(dir, 'settings.json')
  if (contents !== undefined) writeFileSync(file, typeof contents === 'string' ? contents : JSON.stringify(contents))
  const log = memoryLogger()
  const open = () => {
    const store = new SettingsStore(file, log)
    store.registerSection('m', Section)
    return store
  }
  return { dir, file, log, store: open(), open, disk: () => JSON.parse(readFileSync(file, 'utf8')) }
}

test('returns defaults when file missing', () => expect(withStore().store.get('m')).toEqual(Section.defaults))
test('merges stored values over defaults', () => {
  expect(withStore({ m: { size: 5 } }).store.get('m')).toEqual({ mode: 'a', size: 5 })
})
test('invalid section falls back to defaults and keeps raw on disk', () => {
  const s = withStore({ m: { mode: 'zzz' } })
  expect(s.store.get('m')).toEqual(Section.defaults)
  expect(s.disk().m).toEqual({ mode: 'zzz' })
  expect(s.log.messages('warn')).toHaveLength(1)
})
test('corrupt file is backed up and store starts empty', () => {
  const s = withStore('{corrupt')
  expect(s.store.get('m')).toEqual(Section.defaults)
  expect(readdirSync(s.dir).some((f) => f.startsWith('settings.json.corrupt-'))).toBe(true)
  expect(existsSync(s.file)).toBe(false)
})
test('update rejects invalid patch without changing value', () => {
  const { store } = withStore()
  expect(() => store.update('m', { mode: 'x' })).toThrow(SettingsValidationError)
  expect(store.get('m')).toEqual(Section.defaults)
  expect(store.update('m', { size: 3 })).toEqual({ mode: 'a', size: 3 })
})
test('set replaces whole value', () => {
  const s = withStore({ m: { size: 5 } })
  s.store.set('m', { mode: 'b', size: 2 })
  expect(s.open().get('m')).toEqual({ mode: 'b', size: 2 })
})
test('preserves unknown sections on write', () => {
  const s = withStore({ other: { keep: true } })
  s.store.update('m', { size: 2 })
  expect(s.disk()).toEqual({ m: { mode: 'a', size: 2 }, other: { keep: true } })
})
test("onChange fires for section and '*'", () => {
  const { store } = withStore()
  const one = vi.fn()
  const all = vi.fn()
  store.onChange('m', one)
  store.onChange('*', all)
  store.update('m', { size: 9 })
  expect(one).toHaveBeenCalledWith({ mode: 'a', size: 9 }, 'm')
  expect(all).toHaveBeenCalledWith({ mode: 'a', size: 9 }, 'm')
})
test('no .tmp left behind', () => {
  const s = withStore()
  s.store.update('m', { size: 2 })
  expect(readdirSync(s.dir).filter((f) => f.endsWith('.tmp'))).toEqual([])
})
test('passthrough section accepts any record', () => {
  const { store } = withStore()
  store.registerSection('claude', { schema: ProviderSettingsSchema, defaults: {} })
  expect(store.update('claude', { launch: { x: 1 } })).toEqual({ launch: { x: 1 } })
  expect(store.getAll()).toMatchObject({ claude: { launch: { x: 1 } }, m: Section.defaults })
})
