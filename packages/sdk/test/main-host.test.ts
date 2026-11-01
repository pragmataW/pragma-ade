import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, test, vi } from 'vitest'
import { z } from 'zod'
import { CoreIpc } from '../src/common/core-ipc'
import { defineIpc, defineIpcEvent } from '../src/common/ipc'
import { type CapabilityContext, defineCapability } from '../src/common/providers'
import { createServiceToken } from '../src/common/services'
import { ThemeControllerToken } from '../src/common/theme'
import { defineMainModule, type MainContext } from '../src/main/types'
import { CoreModuleError } from '../src/runtime/main/main-host'
import { featureRecord, providerRecord, startHost, tempDir } from './lib/builders'
import { createFakePlatform } from './lib/fake-platform'

declare module '../src/common/providers' {
  interface CapabilityMap {
    hostProbe: { data(): string; settings(): unknown }
  }
}

const Ping = defineIpc({ channel: 'a.ping', input: z.void(), output: z.string() })
const Foreign = defineIpc({ channel: 'b.ping', input: z.void(), output: z.string() })
const Tick = defineIpcEvent({ channel: 'a.tick', payload: z.object({ n: z.number() }) })
const Token = createServiceToken<{ v: number }>('a.thing')
const createTable = (t: string) => `CREATE TABLE ${t} (id INTEGER PRIMARY KEY);`

const recorder = () => {
  const order: string[] = []
  const mod = (id: string, extra: Partial<Parameters<typeof featureRecord>[1]> = {}) =>
    featureRecord(id, {
      main: defineMainModule({
        activate: () => {
          order.push(`activate:${id}`)
        },
        deactivate: () => {
          order.push(`deactivate:${id}`)
        },
      }),
      ...extra,
    })
  return { order, mod }
}

test('activates in dependency order', async () => {
  const { order, mod } = recorder()
  const { host } = await startHost([mod('c', { manifest: { dependsOn: ['b'] } }), mod('b'), mod('a')])
  expect(order).toEqual(['activate:a', 'activate:b', 'activate:c'])
  await host.dispose()
  expect(order.slice(3)).toEqual(['deactivate:c', 'deactivate:b', 'deactivate:a'])
})

describe('failure matrix', () => {
  const throwing = defineMainModule({
    activate(ctx) {
      ctx.ipc.handle(Ping, () => 'x')
      throw new Error('boom')
    },
  })
  const badMigration = defineMainModule({ migrations: true, activate() {} })
  it.each([
    ['missing dependency', featureRecord('a', { manifest: { dependsOn: ['zz'] } }), 'failed', 'missing-dependency'],
    ['activate throws', featureRecord('a', { main: throwing }), 'failed', 'activate-error'],
    [
      'migration error',
      featureRecord('a', {
        main: badMigration,
        migrations: [['0001_bad.sql', `${createTable('a_half')} SELECT * FROM nope;`]],
      }),
      'failed',
      'migration-error',
    ],
  ] as const)('%s', async (_name, record, state, reason) => {
    const dependent = featureRecord('d', { manifest: { dependsOn: ['a'] } })
    const { host } = await startHost([record, dependent, featureRecord('ok')])
    const byId = Object.fromEntries(host.statuses().map((s) => [s.id, s]))
    expect(byId.a).toMatchObject({ state, reason })
    expect(byId.d).toMatchObject({ state: 'disabled', reason: 'dependency-disabled' })
    expect(byId.ok?.state).toBe('active')
    expect(host.router.has(Ping.channel)).toBe(false)
    const tables = host.sqlite.prepare("SELECT name FROM sqlite_master WHERE name = 'a_half'").all()
    expect(tables).toEqual([])
  })
  test('user-disabled', async () => {
    const dir = tempDir()
    const first = await startHost([featureRecord('a')], { userDataDir: dir })
    first.host.setModuleEnabled('a', false)
    await first.host.dispose()
    const { host } = await startHost([featureRecord('a')], { userDataDir: dir })
    expect(host.statuses()[0]).toMatchObject({ state: 'disabled', reason: 'user' })
  })
})

test('core module cannot be disabled', async () => {
  const { host } = await startHost([featureRecord('a', { manifest: { core: true } })])
  expect(() => host.setModuleEnabled('a', false)).toThrow(CoreModuleError)
})

test('migrations applied once across two hosts; dependency migrations first', async () => {
  const dir = tempDir()
  const records = () => [
    featureRecord('b', {
      manifest: { dependsOn: ['a'] },
      main: defineMainModule({ migrations: true, activate() {} }),
      migrations: [['0001_b.sql', 'CREATE TABLE b_x (id INTEGER PRIMARY KEY, a INTEGER REFERENCES a_x(id));']],
    }),
    featureRecord('a', {
      main: defineMainModule({ migrations: true, activate() {} }),
      migrations: [['0009_a.sql', createTable('a_x')]],
    }),
  ]
  const one = await startHost(records(), { userDataDir: dir })
  const rows = () => one.host.sqlite.prepare('SELECT module, name FROM schema_migrations ORDER BY rowid').all()
  expect(rows()).toEqual([
    { module: 'a', name: '0009_a.sql' },
    { module: 'b', name: '0001_b.sql' },
  ])
  await one.host.dispose()
  const two = await startHost(records(), { userDataDir: dir })
  expect(two.host.sqlite.prepare('SELECT count(*) AS n FROM schema_migrations').get()).toEqual({ n: 2 })
})

test('settings defaults; read of another module', async () => {
  let ctxB: MainContext | undefined
  const settings = { schema: z.object({ greeting: z.string() }), defaults: { greeting: 'hello' } }
  await startHost([
    featureRecord('a', { main: defineMainModule({ settings, activate() {} }) }),
    featureRecord('b', {
      manifest: { dependsOn: ['a'] },
      main: defineMainModule({
        activate(ctx) {
          ctxB = ctx as MainContext
        },
      }),
    }),
  ])
  expect(ctxB?.settings.read('a')).toEqual({ greeting: 'hello' })
})

test('test hooks only in testMode', async () => {
  const hook = vi.fn()
  const record = () => featureRecord('a', { main: defineMainModule({ activate() {} }), testHooks: hook })
  await startHost([record()])
  expect(hook).not.toHaveBeenCalled()
  await startHost([record()], { testMode: true })
  expect(hook).toHaveBeenCalledOnce()
})

test('get without dependsOn throws; ThemeControllerToken accessible without dependsOn', async () => {
  const seen: string[] = []
  await startHost([
    featureRecord('a', { main: defineMainModule({ activate: (ctx) => void ctx.services.provide(Token, { v: 1 }) }) }),
    featureRecord('z', {
      main: defineMainModule({
        activate(ctx) {
          seen.push(typeof ctx.services.get(ThemeControllerToken).set)
          try {
            ctx.services.get(Token)
          } catch (e) {
            seen.push((e as Error).name)
          }
        },
      }),
    }),
  ])
  expect(seen).toEqual(['function', 'Error'])
})

test('foreign IPC prefix throws', async () => {
  const { host } = await startHost([
    featureRecord('a', { main: defineMainModule({ activate: (ctx) => void ctx.ipc.handle(Foreign, () => 'x') }) }),
  ])
  expect(host.statuses()[0]).toMatchObject({ state: 'failed', reason: 'activate-error' })
})

test('ctx.ipc.publish reaches the renderer bridge', async () => {
  let ctxA: MainContext | undefined
  const { client } = await startHost([
    featureRecord('a', {
      main: defineMainModule({
        activate(ctx) {
          ctxA = ctx as MainContext
          ctx.ipc.handle(Ping, () => 'pong')
        },
      }),
    }),
  ])
  const cb = vi.fn()
  client.subscribe(Tick, cb)
  ctxA?.ipc.publish(Tick, { n: 1 })
  expect(cb).toHaveBeenCalledWith({ n: 1 })
  expect(await client.invoke(Ping, undefined)).toBe('pong')
})

test('provider capability factory gets capCtx with its settings section and data path; dispose disposes', async () => {
  const dispose = vi.fn()
  const cap = defineCapability('p', 'hostProbe', (capCtx: CapabilityContext) => ({
    data: () => capCtx.paths.data,
    settings: () => capCtx.settings.get(),
    dispose,
  }))
  const { host, userDataDir } = await startHost([providerRecord('p', { capabilities: [cap] })])
  host.settings.update('p', { launch: { x: 1 } })
  const impl = host.providers.capability('p', 'hostProbe')
  expect(impl?.data()).toBe(join(userDataDir, 'providers', 'p'))
  expect(impl?.settings()).toEqual({ launch: { x: 1 } })
  await host.dispose()
  expect(dispose).toHaveBeenCalledOnce()
})

test('ctx.dialogs/shell/notifications/window call the platform adapter', async () => {
  const platform = createFakePlatform({ dialogReplies: { openFolder: '/x' } })
  let folder: string | null = null
  await startHost(
    [
      featureRecord('a', {
        main: defineMainModule({
          async activate(ctx) {
            folder = await ctx.dialogs.openFolder({})
            await ctx.shell.openExternal('https://example.com')
            ctx.notifications.show({ titleKey: 'core:dialogs.confirm', bodyKey: 'core:dialogs.cancel' })
            ctx.window.isFocused()
          },
        }),
      }),
    ],
    { platform },
  )
  expect(folder).toBe('/x')
  expect(platform.calls.map((c) => c.method)).toEqual(
    expect.arrayContaining(['dialogs.openFolder', 'openExternal', 'showNotification']),
  )
})

test('ctx.env.getShellEnv and capCtx.getShellEnv are the same memoised function', async () => {
  let ctxA: MainContext | undefined
  const cap = defineCapability('p', 'hostProbe', (capCtx) => ({
    data: () => '',
    settings: () => capCtx.getShellEnv(),
  }))
  const { host, platform } = await startHost([
    providerRecord('p', { capabilities: [cap] }),
    featureRecord('a', {
      main: defineMainModule({
        activate(ctx) {
          ctxA = ctx as MainContext
        },
      }),
    }),
  ])
  await ctxA?.env.getShellEnv()
  await host.providers.capability('p', 'hostProbe')?.settings()
  expect(platform.calls.filter((c) => c.method === 'getShellEnv')).toHaveLength(1)
})

test('core.shortcuts.list returns registered specs', async () => {
  const { client } = await startHost([
    featureRecord('a', {
      main: defineMainModule({
        activate: (ctx) =>
          void ctx.shortcuts.register({ id: 'a.x', accelerator: 'CmdOrCtrl+Alt+X', scope: 'app', command: 'a.x' }),
      }),
    }),
  ])
  expect((await client.invoke(CoreIpc.shortcutsList, undefined)).map((s) => s.id)).toEqual(['a.x'])
})

test('theme controller set → core.theme.changed published', async () => {
  const { client, host } = await startHost([])
  const cb = vi.fn()
  client.subscribe(CoreIpc.themeChanged, cb)
  host.theme.set({ mode: 'light', palette: 'amber', density: 'compact' })
  expect(cb).toHaveBeenCalledWith(expect.objectContaining({ resolved: 'light', palette: 'amber' }))
})

test('setModuleEnabled persists and reports affected', async () => {
  const { host, client } = await startHost([featureRecord('a'), featureRecord('b', { manifest: { dependsOn: ['a'] } })])
  expect(await client.invoke(CoreIpc.modulesSetEnabled, { id: 'a', enabled: false })).toEqual({
    restartRequired: true,
    affected: ['b'],
  })
  expect(host.settings.get<{ modules: { disabled: string[] } }>('core').modules.disabled).toEqual(['a'])
  expect(host.setModuleEnabled('a', true).affected).toEqual(['b'])
})

test('main→renderer command round-trip', async () => {
  const { host, client, bridge } = await startHost([])
  await client.invoke(CoreIpc.commandsAnnounce, [{ id: 'r.cmd' }])
  bridge.subscribe(CoreIpc.commandsRunInRenderer.channel, (req) => {
    const { requestId, args } = req as { requestId: string; args: number }
    void client.invoke(CoreIpc.commandsRendererResult, { requestId, ok: true, value: args * 2 })
  })
  expect(await host.commands.execute('r.cmd', 21)).toBe(42)
})

test('dispose closes the database', async () => {
  const { host, userDataDir } = await startHost([])
  await host.dispose()
  expect(existsSync(join(userDataDir, 'pragma.db'))).toBe(true)
  expect(() => host.sqlite.prepare('SELECT 1').get()).toThrow()
})
