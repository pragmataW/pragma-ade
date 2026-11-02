import { describe, expect, it, test } from 'vitest'
import { createRegistries, DuplicateRegistrationError, type Registries } from '../src/runtime/renderer/registries'

const Nothing = () => null
type Kind = 'tabs' | 'views' | 'settingsPages'
type Extra = { default?: boolean }
const adders: Record<Kind, (r: Registries, id: string, order: number, extra?: Extra) => { dispose(): void }> = {
  tabs: (r, id, order, extra) =>
    r.registerRightTab({ id, titleKey: 'x:y', icon: 'x', order, component: Nothing, ...extra }),
  views: (r, id, order, extra) =>
    r.registerCenterView({ id, titleKey: 'x:y', icon: 'x', order, component: Nothing, ...extra }),
  settingsPages: (r, id, order) => r.registerSettingsPage({ id, titleKey: 'x:y', order, component: Nothing }),
}

describe.each(Object.keys(adders) as Kind[])('%s', (kind) => {
  const add = adders[kind]
  const ids = (r: Registries) => r.store.getState()[kind].map((x) => x.id)
  test('sorted by order', () => {
    const r = createRegistries()
    add(r, 'b', 20)
    add(r, 'a', 10)
    expect(ids(r)).toEqual(['a', 'b'])
  })
  test('duplicate id throws', () => {
    const r = createRegistries()
    add(r, 'a', 1)
    expect(() => add(r, 'a', 2)).toThrow(DuplicateRegistrationError)
  })
  test('dispose removes', () => {
    const r = createRegistries()
    add(r, 'a', 1).dispose()
    expect(ids(r)).toEqual([])
  })
})

it.each([
  ['activateRightTab', 'activeTab', (r: Registries) => r.activateRightTab('b')],
  ['views.activate', 'activeView', (r: Registries) => r.activateView('b')],
] as const)('%s sets the active id', (_name, key, activate) => {
  const r = createRegistries()
  const kind = key === 'activeTab' ? 'tabs' : 'views'
  adders[kind](r, 'a', 1)
  adders[kind](r, 'b', 2)
  expect(r.store.getState()[key]).toBe('a')
  activate(r)
  expect(r.store.getState()[key]).toBe('b')
})
describe.each([
  ['tabs', 'activeTab', (r: Registries, id: string) => r.activateRightTab(id)],
  ['views', 'activeView', (r: Registries, id: string) => r.activateView(id)],
] as const)('%s default', (kind, key, activate) => {
  const add = adders[kind]
  const active = (r: Registries) => r.store.getState()[key]
  test('the default entry is initially active, even registered after a lower order', () => {
    const r = createRegistries()
    add(r, 'first', 1)
    const preferred = add(r, 'preferred', 2, { default: true })
    add(r, 'other', 0)
    expect(active(r)).toBe('preferred')
    preferred.dispose()
    expect(active(r)).toBe('other')
  })
  test('an explicit activation wins over the default', () => {
    const r = createRegistries()
    add(r, 'first', 1)
    activate(r, 'first')
    add(r, 'preferred', 2, { default: true })
    expect(active(r)).toBe('first')
  })
})
test('setBadge sets and clears a count', () => {
  const r = createRegistries()
  r.setBadge('git', 3)
  expect(r.store.getState().badges).toEqual({ git: 3 })
  r.setBadge('git', null)
  expect(r.store.getState().badges).toEqual({})
})
