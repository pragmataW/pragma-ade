import { describe, expect, test, vi } from 'vitest'
import {
  type CapabilityContext,
  defineCapability,
  defineProvider,
  defineRendererCapability,
  type ProviderDescriptor,
} from '../src/common/providers'
import {
  ProviderMismatchError,
  ProviderRegistry,
  RendererProviderRegistry,
} from '../src/runtime/shared/provider-registry'
import { memoryLogger } from './lib/builders'

declare module '../src/index' {
  interface CapabilityMap {
    fakePing: { ping(): string }
  }
  interface RendererCapabilityMap {
    fakeBadge: { label: string }
  }
}

const descriptor = (id: string): ProviderDescriptor =>
  defineProvider({ id, displayNameKey: `${id}:provider.name`, icon: id, defaultCommand: id, defaultArgs: [] })
const capCtxFor = (providerId: string) => ({ paths: { data: `/data/${providerId}` } }) as unknown as CapabilityContext
const setup = () => {
  const log = memoryLogger()
  const registry = new ProviderRegistry(capCtxFor, log)
  return { log, registry, api: registry.api() }
}

describe('ProviderRegistry', () => {
  test('lists providers sorted', () => {
    const { registry, api } = setup()
    registry.add('zeta', descriptor('zeta'), [])
    registry.add('alpha', descriptor('alpha'), [])
    expect(api.list().map((p) => p.id)).toEqual(['alpha', 'zeta'])
    expect(api.get('alpha')?.defaultCommand).toBe('alpha')
  })
  test('factory receives capCtx for its provider and is created once', () => {
    const { registry, api } = setup()
    const factory = vi.fn((capCtx: CapabilityContext) => ({ ping: () => capCtx.paths.data }))
    registry.add('p', descriptor('p'), [defineCapability('p', 'fakePing', factory)])
    expect(api.capability('p', 'fakePing')?.ping()).toBe('/data/p')
    api.capability('p', 'fakePing')
    expect(factory).toHaveBeenCalledOnce()
  })
  test('capability returns undefined when provider lacks key', () => {
    const { registry, api } = setup()
    registry.add('p', descriptor('p'), [])
    expect(api.capability('p', 'fakePing')).toBeUndefined()
    expect(api.capability('missing', 'fakePing')).toBeUndefined()
  })
  test('providersWith does not instantiate', () => {
    const { registry, api } = setup()
    const factory = vi.fn(() => ({ ping: () => 'x' }))
    registry.add('p', descriptor('p'), [defineCapability('p', 'fakePing', factory)])
    registry.add('q', descriptor('q'), [])
    expect(api.providersWith('fakePing').map((p) => p.id)).toEqual(['p'])
    expect(factory).not.toHaveBeenCalled()
  })
  test('disposeAll calls dispose on created capabilities only, survives a throwing dispose', async () => {
    const { registry, api, log } = setup()
    const disposeA = vi.fn(() => {
      throw new Error('boom')
    })
    const disposeB = vi.fn()
    registry.add('a', descriptor('a'), [defineCapability('a', 'fakePing', { ping: () => 'a', dispose: disposeA })])
    registry.add('b', descriptor('b'), [
      defineCapability('b', 'fakePing', () => ({ ping: () => 'b', dispose: disposeB })),
    ])
    registry.add('c', descriptor('c'), [
      defineCapability('c', 'fakePing', () => ({ ping: () => 'c', dispose: disposeB })),
    ])
    api.capability('a', 'fakePing')
    api.capability('b', 'fakePing')
    await registry.disposeAll()
    expect(disposeA).toHaveBeenCalledOnce()
    expect(disposeB).toHaveBeenCalledOnce()
    expect(log.messages('error')).toHaveLength(1)
  })
  test('descriptor id must equal module id', () => {
    expect(() => setup().registry.add('p', descriptor('q'), [])).toThrow(ProviderMismatchError)
  })
  test('foreign providerId capability skipped and logged', () => {
    const { registry, api, log } = setup()
    registry.add('p', descriptor('p'), [defineCapability('other', 'fakePing', { ping: () => 'x' })])
    expect(api.capability('p', 'fakePing')).toBeUndefined()
    expect(log.messages('warn')).toHaveLength(1)
  })
  test('in-test fake provider is discoverable without touching core', () => {
    const { registry, api } = setup()
    registry.add('fake', descriptor('fake'), [defineCapability('fake', 'fakePing', { ping: () => 'pong' })])
    expect(api.providersWith('fakePing').map((p) => `${p.id}:${api.capability(p.id, 'fakePing')?.ping()}`)).toEqual([
      'fake:pong',
    ])
  })
})

const Icon = () => null

test('renderer registry returns icon and rendererCapability', () => {
  const registry = new RendererProviderRegistry(memoryLogger())
  registry.add('p', descriptor('p'), Icon, [defineRendererCapability('p', 'fakeBadge', { label: 'L' })])
  const api = registry.api()
  expect(api.icon('p')).toBe(Icon)
  expect(api.rendererCapability('p', 'fakeBadge')?.label).toBe('L')
  expect(api.providersWithRenderer('fakeBadge').map((p) => p.id)).toEqual(['p'])
  expect(api.list().map((p) => p.id)).toEqual(['p'])
})
