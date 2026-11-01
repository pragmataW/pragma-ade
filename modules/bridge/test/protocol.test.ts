import { z } from '@pragma/sdk'
import { describe, expect, expectTypeOf, it } from 'vitest'
import {
  BridgeEnvelopeSchema,
  type BridgeHandlers,
  BridgeInfoFileSchema,
  BridgeResultSchema,
  defineBridgeNamespace,
  joinBridgeType,
  splitBridgeType,
  wsUrlFor,
} from '../src/contract'

describe('bridge protocol', () => {
  it('envelope accepts agent.hookEvent and defaults payload to null', () => {
    expect(BridgeEnvelopeSchema.parse({ type: 'agent.hookEvent' })).toEqual({ type: 'agent.hookEvent', payload: null })
  })

  it.each(['hook', 'Agent.x', '.x', 'agent.', '1a.x'])('rejects the type %s', (type) => {
    expect(BridgeEnvelopeSchema.safeParse({ type, payload: {} }).success).toBe(false)
  })

  it('id longer than 128 rejected', () => {
    expect(BridgeEnvelopeSchema.safeParse({ type: 'a.b', id: 'x'.repeat(129) }).success).toBe(false)
    expect(BridgeEnvelopeSchema.safeParse({ type: 'a.b', id: 'x'.repeat(128) }).success).toBe(true)
  })

  it.each([
    ['editor.open.file', { namespace: 'editor', name: 'open.file' }],
    ['agent.hookEvent', { namespace: 'agent', name: 'hookEvent' }],
  ])('splitBridgeType(%s)', (type, parts) => {
    expect(splitBridgeType(type)).toEqual(parts)
  })

  it('joinBridgeType round-trips', () => {
    const parts = splitBridgeType(joinBridgeType('cli', 'task.get'))
    expect(parts).toEqual({ namespace: 'cli', name: 'task.get' })
  })

  it('result union parses an error with code unauthorized', () => {
    const parsed = BridgeResultSchema.parse({ type: 'bridge.error', error: { code: 'unauthorized', message: 'no' } })
    expect(parsed.type).toBe('bridge.error')
  })

  it.each([
    ['http://127.0.0.1:5', 'ws://127.0.0.1:5/ws'],
    ['https://h:7/', 'wss://h:7/ws'],
  ])('wsUrlFor(%s)', (http, ws) => {
    expect(wsUrlFor(http)).toBe(ws)
  })

  it('info file schema rejects a short token', () => {
    const base = { version: 1, url: 'http://127.0.0.1:1', wsUrl: 'ws://127.0.0.1:1/ws', pid: 1, startedAt: 'now' }
    expect(BridgeInfoFileSchema.safeParse({ ...base, token: 'short' }).success).toBe(false)
    expect(BridgeInfoFileSchema.safeParse({ ...base, token: 'x'.repeat(43) }).success).toBe(true)
  })

  it('BridgeHandlers types the payload from the input schema', () => {
    const ns = defineBridgeNamespace({
      name: 'demo',
      requests: { x: { input: z.object({ n: z.number() }), output: z.object({ ok: z.boolean() }) } },
      events: {},
    })
    expectTypeOf<Parameters<BridgeHandlers<typeof ns>['x']>[0]>().toEqualTypeOf<{ n: number }>()
  })
})
