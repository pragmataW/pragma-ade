import { describe, expect, it, test } from 'vitest'
import { createRegistries, DuplicateRegistrationError, type Registries } from '../src/runtime/renderer/registries'

const Nothing = () => null
type Kind = 'tabs' | 'views' | 'settingsPages'
const adders: Record<Kind, (r: Registries, id: string, order: number) => { dispose(): void }> = {
  tabs: (r, id, order) => r.registerRightTab({ id, titleKey: 'x:y', icon: 'x', order, component: Nothing }),
  views: (r, id, order) => r.registerCenterView({ id, titleKey: 'x:y', icon: 'x', order, component: Nothing }),
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
test('default view wins as the initial active view', () => {
  const r = createRegistries()
  r.registerCenterView({ id: 'board', titleKey: 'x:y', icon: 'x', order: 1, component: Nothing })
  r.registerCenterView({ id: 'agents', titleKey: 'x:y', icon: 'x', order: 2, component: Nothing, default: true })
  expect(r.store.getState().activeView).toBe('agents')
})
test('setBadge sets and clears a count', () => {
  const r = createRegistries()
  r.setBadge('git', 3)
  expect(r.store.getState().badges).toEqual({ git: 3 })
  r.setBadge('git', null)
  expect(r.store.getState().badges).toEqual({})
})
