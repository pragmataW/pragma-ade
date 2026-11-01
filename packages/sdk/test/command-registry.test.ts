import { expect, test, vi } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '../src/common/commands'
import {
  createCommandRegistry,
  DuplicateCommandError,
  type RemoteCommands,
  UnknownCommandError,
} from '../src/runtime/shared/command-registry'

const remote = (ids: string[]): RemoteCommands => ({
  has: (id) => ids.includes(id),
  execute: vi.fn(async (id, args) => ({ remote: id, args })),
  list: () => ids.map((id) => ({ id })),
})

test('local commands run before remote ones', async () => {
  const reg = createCommandRegistry({ remote: remote(['a.x', 'a.y']) })
  reg.register('a.x', () => 'local')
  expect(await reg.execute('a.x')).toBe('local')
  expect(await reg.execute('a.y', 1)).toEqual({ remote: 'a.y', args: 1 })
  expect(reg.has('a.y')).toBe(true)
  expect(reg.list().map((c) => c.id)).toEqual(['a.x', 'a.y'])
  expect(reg.listLocal().map((c) => c.id)).toEqual(['a.x'])
})
test('CommandDef validates arguments', async () => {
  const reg = createCommandRegistry()
  const Open = defineCommand({ id: 'editor.openFile', args: z.object({ path: z.string() }) })
  reg.register(Open, (a) => a.path, { titleKey: 'editor:open', palette: true })
  expect(await reg.execute('editor.openFile', { path: '/x' })).toBe('/x')
  await expect(reg.execute('editor.openFile', { path: 1 })).rejects.toThrow()
  expect(reg.list()).toEqual([{ id: 'editor.openFile', titleKey: 'editor:open', palette: true }])
})
test('unknown and duplicate ids throw', async () => {
  const reg = createCommandRegistry()
  reg.register('a.x', () => 1)
  expect(() => reg.register('a.x', () => 2)).toThrow(DuplicateCommandError)
  await expect(reg.execute('a.missing')).rejects.toThrow(UnknownCommandError)
})
test('onChange fires on register, dispose and setRemote', () => {
  const reg = createCommandRegistry()
  const cb = vi.fn()
  reg.onChange(cb)
  reg.register('a.x', () => 1).dispose()
  reg.setRemote(remote([]))
  expect(cb).toHaveBeenCalledTimes(3)
})
