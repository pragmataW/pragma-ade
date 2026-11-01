import { aProfile } from '@pragma/module-agents/testing'
import { expect, it } from 'vitest'
import type { AgentSession } from '../../src/contract'
import {
  commandPreview,
  initialActiveTab,
  launchableProfiles,
  nextActiveTab,
  profileName,
} from '../../src/renderer/view-model'

const builtin = aProfile({ isBuiltin: true, stockCommand: 'claude', stockArgs: [], command: 'claude', args: [] })

it.each([
  [
    {
      ...builtin,
      commandOverride: 'dgc',
      argsOverride: '--dangerously-skip-permissions',
      command: 'dgc',
      args: ['--dangerously-skip-permissions'],
    },
    { stock: 'claude', effective: 'dgc --dangerously-skip-permissions', customized: true },
  ],
  [builtin, { stock: 'claude', effective: 'claude', customized: false }],
  [
    aProfile({ command: '/bin/fake', args: ['two words'] }),
    { stock: null, effective: "/bin/fake 'two words'", customized: false },
  ],
])('commandPreview %#', (p, out) => expect(commandPreview(p)).toEqual(out))

it('profileName prefers the name, else the provider display name', () => {
  const t = (k: string) => `T(${k})`
  expect(profileName(aProfile({ name: 'Fake' }), t)).toBe('Fake')
  expect(profileName(aProfile({ name: null, displayNameKey: 'claude:provider.name' }), t)).toBe(
    'T(claude:provider.name)',
  )
})

it('launchableProfiles hides disabled and unavailable, default first', () => {
  const ps = [
    aProfile({ id: 'a' }),
    aProfile({ id: 'b', enabled: false }),
    aProfile({ id: 'c', available: false }),
    aProfile({ id: 'd', isDefault: true }),
  ]
  expect(launchableProfiles(ps).map((p) => p.id)).toEqual(['d', 'a'])
})

const s = (id: string, lastFocusedAt: number | null = null) => ({ id, lastFocusedAt }) as AgentSession
it.each([
  [['a', 'b', 'c'], 'b', 'c'],
  [['a', 'b', 'c'], 'c', 'b'],
  [['a'], 'a', null],
  [['a', 'b'], 'zz', 'b'],
])('nextActiveTab(%j, %s) = %s', (ids, removed, next) =>
  expect(
    nextActiveTab(
      ids.map((i) => s(i)),
      removed,
    ),
  ).toBe(next),
)

it('initialActiveTab prefers the most recently focused, else the last', () => {
  expect(initialActiveTab([s('a', 5), s('b', 9), s('c')])).toBe('b')
  expect(initialActiveTab([s('a'), s('b')])).toBe('b')
  expect(initialActiveTab([])).toBeNull()
})
