import type { TestModuleHost } from '@pragma/test-support'
import { afterEach, describe, expect, it } from 'vitest'
import { COMMANDS, SHORTCUTS } from '../src/constants'
import { ExampleIpc, type ItemAdded } from '../src/contract'
import { startExample } from './lib/builders'

let t: TestModuleHost | undefined
afterEach(async () => {
  await t?.dispose()
  t = undefined
})

describe('example module', () => {
  it('hello returns Hello, Ada', async () => {
    t = await startExample()
    expect(await t.ipc.invoke(ExampleIpc.hello, { name: 'Ada' })).toEqual({ text: 'Hello, Ada' })
  })

  it('hello falls back to the configured name', async () => {
    t = await startExample({ example: { name: 'Grace' } })
    expect(await t.ipc.invoke(ExampleIpc.hello, {})).toEqual({ text: 'Hello, Grace' })
  })

  it('the migration creates example_items', async () => {
    t = await startExample()
    const row = t.host.sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'example_items'")
      .get()
    expect(row).toEqual({ name: 'example_items' })
  })

  it('the service counts items', async () => {
    t = await startExample()
    await t.ipc.invoke(ExampleIpc.addItem, { label: 'one' })
    await t.ipc.invoke(ExampleIpc.addItem, { label: 'two' })
    expect(await t.ipc.invoke(ExampleIpc.countItems, undefined)).toEqual({ count: 2 })
  })

  it('itemAdded is published', async () => {
    t = await startExample()
    const seen: ItemAdded[] = []
    t.ipc.subscribe(ExampleIpc.itemAdded, (e) => seen.push(e))
    await t.ipc.invoke(ExampleIpc.addItem, { label: 'one' })
    expect(seen).toEqual([{ item: { id: 1, label: 'one' }, total: 1 }])
  })

  it('the shortcut is registered with app scope', async () => {
    t = await startExample()
    expect(t.host.shortcuts.list()).toContainEqual(
      expect.objectContaining({
        id: SHORTCUTS.sayHello.id,
        accelerator: 'CmdOrCtrl+Alt+E',
        scope: 'app',
        command: COMMANDS.sayHello,
      }),
    )
  })
})
