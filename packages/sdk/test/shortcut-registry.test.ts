import { expect, it, test } from 'vitest'
import { type KeyInput, RESERVED_EDITOR_CHORDS, type ShortcutSpec } from '../src/common/shortcuts'
import {
  createShortcutRegistry,
  ReservedShortcutError,
  ShortcutConflictError,
} from '../src/runtime/shared/shortcut-registry'
import { memoryLogger } from './lib/builders'

const spec = (id: string, accelerator: string, scope: ShortcutSpec['scope']): ShortcutSpec => ({
  id,
  accelerator,
  scope,
  command: `${id}.run`,
})
const key = (k: string, mods: Partial<KeyInput> = {}): KeyInput => ({
  key: k,
  meta: false,
  control: false,
  shift: false,
  alt: false,
  ...mods,
})
const registry = () => createShortcutRegistry('darwin', memoryLogger())

test('global spec matches with native-view focus', () => {
  const r = registry()
  r.register(spec('g', 'CmdOrCtrl+Shift+E', 'global'))
  expect(r.match(key('e', { meta: true, shift: true }), 'native-view')?.id).toBe('g')
})
test('app spec does not match with native-view focus', () => {
  const r = registry()
  r.register(spec('a', 'CmdOrCtrl+Alt+E', 'app'))
  const input = key('e', { meta: true, alt: true })
  expect(r.match(input, 'native-view')).toBeUndefined()
  expect(r.match(input, 'app')?.id).toBe('a')
})
it.each(RESERVED_EDITOR_CHORDS)('reserved chord %s cannot be global', (acc) => {
  expect(() => registry().register(spec('x', acc, 'global'))).toThrow(ReservedShortcutError)
})
test('same chord in overlapping scope throws ShortcutConflictError', () => {
  const r = registry()
  r.register(spec('a', 'CmdOrCtrl+Shift+E', 'global'))
  expect(() => r.register(spec('b', 'Cmd+Shift+E', 'app'))).toThrow(ShortcutConflictError)
})
test('app-scope CmdOrCtrl+K is allowed', () => {
  const r = registry()
  const d = r.register(spec('palette', 'CmdOrCtrl+K', 'app'))
  expect(r.list().map((s) => s.id)).toEqual(['palette'])
  d.dispose()
  expect(r.list()).toEqual([])
})
