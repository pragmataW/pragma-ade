import { expect, it } from 'vitest'
import { LaunchDecoratorRegistry } from '../../src/main/launch/decorators'
import { decorator } from '../support/fakes'

const keep = (spec: Parameters<Parameters<typeof decorator>[2]>[0]) => spec

it('sorted by order then id', () => {
  const r = new LaunchDecoratorRegistry()
  r.register(decorator('b', 20, keep))
  r.register(decorator('z', 10, keep))
  r.register(decorator('a', 20, keep))
  expect(r.list().map((d) => d.id)).toEqual(['z', 'a', 'b'])
})

it('duplicate id throws', () => {
  const r = new LaunchDecoratorRegistry()
  r.register(decorator('a', 1, keep))
  expect(() => r.register(decorator('a', 2, keep))).toThrow(/already registered/)
})

it('disposer unregisters', () => {
  const r = new LaunchDecoratorRegistry()
  const off = r.register(decorator('a', 1, keep))
  off()
  expect(r.list()).toEqual([])
})
