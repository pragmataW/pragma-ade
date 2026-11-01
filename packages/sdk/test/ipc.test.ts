import { expect, it, test, vi } from 'vitest'
import { z } from 'zod'
import { defineIpc, defineIpcEvent, IpcError } from '../src/common/ipc'
import { DuplicateHandlerError, IpcRouter } from '../src/runtime/main/ipc-router'
import { createIpcClient } from '../src/runtime/renderer/ipc-client'
import { createMemoryTransport, type IpcMeta } from '../src/runtime/shared/memory-transport'
import { memoryLogger } from './lib/builders'

const Ping = defineIpc({
  channel: 'probe.ping',
  input: z.object({ msg: z.string() }),
  output: z.object({ pong: z.string() }),
})
const Tick = defineIpcEvent({ channel: 'probe.tick', payload: z.object({ n: z.number() }) })

const setup = () => {
  const { transport, bridge } = createMemoryTransport()
  const log = memoryLogger()
  const router = new IpcRouter(transport, log)
  return { router, bridge, transport, log, client: createIpcClient(bridge, log) }
}

test('round-trip with meta', async () => {
  const { router, client } = setup()
  const handler = vi.fn(({ msg }: { msg: string }, _meta: IpcMeta) => ({ pong: msg }))
  router.handle(Ping, handler)
  expect(await client.invoke(Ping, { msg: 'x' })).toEqual({ pong: 'x' })
  expect(handler.mock.calls[0]?.[1]).toEqual({ senderId: 1 })
})
it.each([
  ['NO_HANDLER', false, { msg: 'x' }, () => ({ pong: 'x' })],
  ['INVALID_INPUT', true, { msg: 1 }, () => ({ pong: 'x' })],
  [
    'HANDLER_ERROR',
    true,
    { msg: 'x' },
    () => {
      throw new Error('boom')
    },
  ],
  ['INVALID_OUTPUT', true, { msg: 'x' }, () => ({ pong: 1 })],
])('error envelope %s', async (code, register, input, handler) => {
  const { router, bridge } = setup()
  if (register) router.handle(Ping, handler as never)
  const res = await bridge.invoke(Ping.channel, input)
  expect(res).toMatchObject({ ok: false, error: { code } })
})
test('client rejects invalid input locally and throws IpcError on ok:false', async () => {
  const { bridge, client } = setup()
  const spy = vi.spyOn(bridge, 'invoke')
  await expect(client.invoke(Ping, { msg: 1 } as never)).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  expect(spy).not.toHaveBeenCalled()
  await expect(client.invoke(Ping, { msg: 'x' })).rejects.toBeInstanceOf(IpcError)
})
test('owner prefix and duplicates are enforced', () => {
  const { router } = setup()
  expect(() => router.handle(Ping, () => ({ pong: '' }), 'other')).toThrow()
  router.handle(Ping, () => ({ pong: '' }), 'probe')
  expect(() => router.handle(Ping, () => ({ pong: '' }))).toThrow(DuplicateHandlerError)
})
test('publish validates the payload and reaches subscribers; dispose stops delivery', () => {
  const { router, client } = setup()
  const cb = vi.fn()
  const sub = client.subscribe(Tick, cb)
  router.publish(Tick, { n: 1 })
  expect(() => router.publish(Tick, { n: 'x' } as never)).toThrow()
  sub.dispose()
  router.publish(Tick, { n: 2 })
  expect(cb.mock.calls).toEqual([[{ n: 1 }]])
})
test('client drops invalid event payloads with a warning', () => {
  const { transport, client, log } = setup()
  const cb = vi.fn()
  client.subscribe(Tick, cb)
  transport.broadcast(Tick.channel, { n: 'bad' })
  expect(cb).not.toHaveBeenCalled()
  expect(log.messages('warn')).toHaveLength(1)
})
