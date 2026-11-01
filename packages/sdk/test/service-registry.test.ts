import { describe, expect, it, test } from 'vitest'
import { createServiceToken } from '../src/common/services'
import {
  createServiceRegistry,
  DuplicateServiceError,
  ServiceAccessError,
  ServiceNotFoundError,
  ServiceOwnershipError,
} from '../src/runtime/shared/service-registry'

const PtyToken = createServiceToken<{ spawn(): number }>('terminal.pty')
const ThemeToken = createServiceToken<{ mode: string }>('core.theme')
const deps = (required: string[] = [], optional: string[] = []) => ({ required, optional })

describe('service registry', () => {
  const setup = () => {
    const reg = createServiceRegistry()
    reg.scope('terminal', deps()).provide(PtyToken, { spawn: () => 1 })
    reg.scope('core', deps()).provide(ThemeToken, { mode: 'dark' })
    return reg
  }
  it.each([
    ['required dependency get', deps(['terminal']), 'get', undefined],
    ['optional dependency tryGet', deps([], ['terminal']), 'tryGet', undefined],
    ['optional dependency get', deps([], ['terminal']), 'get', ServiceAccessError],
    ['no dependency get', deps(), 'get', ServiceAccessError],
    ['no dependency tryGet', deps(), 'tryGet', ServiceAccessError],
  ] as const)('%s', (_name, d, method, error) => {
    const scope = setup().scope('agents', d)
    const call = () => scope[method](PtyToken)
    if (error) expect(call).toThrow(error)
    else expect(call()?.spawn()).toBe(1)
  })
  test('core token is accessible without dependsOn', () => {
    expect(setup().scope('agents', deps()).get(ThemeToken).mode).toBe('dark')
  })
  test('provide checks ownership and duplicates', () => {
    const reg = setup()
    expect(() => reg.scope('agents', deps()).provide(PtyToken, { spawn: () => 2 })).toThrow(ServiceOwnershipError)
    expect(() => reg.scope('terminal', deps()).provide(PtyToken, { spawn: () => 2 })).toThrow(DuplicateServiceError)
  })
  test('tryGet returns undefined for an unprovided token; get throws', () => {
    const scope = createServiceRegistry().scope('agents', deps(['terminal']))
    expect(scope.tryGet(PtyToken)).toBeUndefined()
    expect(() => scope.get(PtyToken)).toThrow(ServiceNotFoundError)
  })
  test('dispose removes the service', () => {
    const reg = createServiceRegistry()
    const d = reg.scope('terminal', deps()).provide(PtyToken, { spawn: () => 1 })
    d.dispose()
    expect(reg.has(PtyToken)).toBe(false)
  })
})
