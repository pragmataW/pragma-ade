import { describe, expect, it } from 'vitest'
import { BRIDGE_ERROR, type BridgeErrorCode } from '../src/contract'
import { HandlerRegistry, resultError, resultOk } from '../src/main/registry'
import { demoHandlers, demoNs, httpCtx } from './support/namespaces'

const registryWithDemo = (): HandlerRegistry => {
  const r = new HandlerRegistry()
  r.register(demoNs, demoHandlers)
  return r
}

describe('HandlerRegistry', () => {
  it('dispatches a typed request and echoes the id', async () => {
    const result = await registryWithDemo().dispatch({ type: 'demo.echo', id: 'r1', payload: { text: 'hi' } }, httpCtx)
    expect(result).toEqual(resultOk('r1', { text: 'hi' }))
  })

  it.each<[string, unknown, BridgeErrorCode, string?]>([
    ['demo.echo', { text: 1 }, BRIDGE_ERROR.invalid_payload],
    ['demo.fail', null, BRIDGE_ERROR.handler_error, 'boom'],
    ['demo.bad', null, BRIDGE_ERROR.handler_error, 'invalid handler output'],
    ['other.echo', null, BRIDGE_ERROR.unknown_type],
    ['demo.nope', null, BRIDGE_ERROR.unknown_type],
  ])('%s with %j → %s', async (type, payload, code, message) => {
    const result = await registryWithDemo().dispatch({ type, id: 'e', payload }, httpCtx)
    expect(result).toMatchObject({ type: 'bridge.error', id: 'e', error: { code } })
    if (message && result.type === 'bridge.error') expect(result.error.message).toBe(message)
  })

  it('handler errors carry no stack', async () => {
    const result = await registryWithDemo().dispatch({ type: 'demo.fail', payload: null }, httpCtx)
    expect(JSON.stringify(result)).not.toContain('at ')
  })

  it('the reserved namespace throws on register', () => {
    expect(() => new HandlerRegistry().register('bridge', {})).toThrow(/reserved/)
  })

  it('a duplicate namespace throws', () => {
    expect(() => registryWithDemo().register(demoNs, demoHandlers)).toThrow(/already/)
  })

  it('the disposer unregisters', () => {
    const r = new HandlerRegistry()
    const dispose = r.register(demoNs, demoHandlers)
    expect(r.has('demo')).toBe(true)
    dispose()
    expect(r.has('demo')).toBe(false)
  })

  it('raw string registration skips validation', async () => {
    const r = new HandlerRegistry()
    r.register('raw', { any: (payload) => ({ got: payload }) })
    expect(await r.dispatch({ type: 'raw.any', payload: 5 }, httpCtx)).toEqual(resultOk(undefined, { got: 5 }))
  })

  it('eventSchema reads a def event', () => {
    const r = registryWithDemo()
    expect(r.eventSchema('demo', 'tick')?.safeParse({ n: 1 }).success).toBe(true)
    expect(r.eventSchema('demo', 'nope')).toBeUndefined()
  })

  it('resultError builds an error result', () => {
    expect(resultError('x', BRIDGE_ERROR.timeout, 'late')).toEqual({
      type: 'bridge.error',
      id: 'x',
      error: { code: 'timeout', message: 'late' },
    })
  })
})
