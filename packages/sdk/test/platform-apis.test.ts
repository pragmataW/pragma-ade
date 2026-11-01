import { expect, it, test, vi } from 'vitest'
import { createPlatformApis, UnsupportedUrlError } from '../src/runtime/main/platform-apis'
import { memoryLogger } from './lib/builders'
import { createFakePlatform } from './lib/fake-platform'

const t = (key: string) => `T(${key})`
const setup = (opts: Parameters<typeof createFakePlatform>[0] = {}) => {
  const platform = createFakePlatform(opts)
  const commands = { execute: vi.fn(async () => undefined) }
  const apis = createPlatformApis(platform, { t }, commands, memoryLogger())
  return { platform, commands, apis }
}

it.each([
  ['openFolder', { titleKey: 'core:x' }, { title: 'T(core:x)' }, '/picked'],
  [
    'openFile',
    { titleKey: 'core:x', filters: [{ nameKey: 'core:f', extensions: ['ts'] }] },
    { title: 'T(core:x)', filters: [{ name: 'T(core:f)', extensions: ['ts'] }] },
    ['/a.ts'],
  ],
  [
    'confirm',
    { titleKey: 'core:t', messageKey: 'core:m' },
    {
      title: 'T(core:t)',
      message: 'T(core:m)',
      confirmLabel: 'T(core:dialogs.confirm)',
      cancelLabel: 'T(core:dialogs.cancel)',
    },
    true,
  ],
] as const)('dialogs.%s translates keys and passes through results', async (method, input, expected, reply) => {
  const { apis, platform } = setup({ dialogReplies: { [method]: reply } })
  const call = apis.dialogs[method] as (i: unknown) => Promise<unknown>
  expect(await call(input)).toEqual(reply)
  expect(platform.calls).toEqual([{ method: `dialogs.${method}`, args: [expect.objectContaining(expected)] }])
})
test('confirm uses explicit confirm/cancel keys when given', async () => {
  const { apis, platform } = setup()
  await apis.dialogs.confirm({
    titleKey: 'a:b',
    messageKey: 'a:c',
    confirmKey: 'a:yes',
    cancelKey: 'a:no',
    destructive: true,
  })
  expect(platform.calls[0]?.args[0]).toMatchObject({
    confirmLabel: 'T(a:yes)',
    cancelLabel: 'T(a:no)',
    destructive: true,
  })
})
it.each([
  ['https://x', true],
  ['mailto:a@b', true],
  ['file:///etc', false],
  ['javascript:x', false],
])('openExternal(%s) allowed=%s', async (url, allowed) => {
  const { apis, platform } = setup()
  const run = apis.shell.openExternal(url)
  if (allowed) {
    await run
    expect(platform.calls).toEqual([{ method: 'openExternal', args: [url] }])
  } else await expect(run).rejects.toBeInstanceOf(UnsupportedUrlError)
})
test('notification click runs the command', () => {
  const { apis, platform, commands } = setup()
  apis.notifications.show({ titleKey: 'a:t', bodyKey: 'a:b', onClickCommand: { id: 'x.y', args: { n: 1 } } })
  expect(platform.calls[0]).toEqual({ method: 'showNotification', args: [{ title: 'T(a:t)', body: 'T(a:b)' }] })
  platform.clickNotification(0)
  expect(commands.execute).toHaveBeenCalledWith('x.y', { n: 1 })
})
test('ctx.window focus reflects adapter and notifies onFocusChange', () => {
  const { apis, platform } = setup()
  const cb = vi.fn()
  apis.window.onFocusChange(cb)
  expect(apis.window.isFocused()).toBe(true)
  platform.setFocused(false)
  expect(apis.window.isFocused()).toBe(false)
  expect(cb).toHaveBeenCalledWith(false)
})
test('env.getShellEnv is memoised and resolveCommand uses it', async () => {
  const { apis, platform } = setup({ shellEnv: { PATH: '/nowhere' } })
  await apis.env.getShellEnv()
  await apis.env.getShellEnv()
  expect(await apis.env.resolveCommand('definitely-not-a-command')).toBeNull()
  expect(platform.calls.filter((c) => c.method === 'getShellEnv')).toHaveLength(1)
})
