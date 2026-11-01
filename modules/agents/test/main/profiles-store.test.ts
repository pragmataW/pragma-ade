import { describe, expect, it } from 'vitest'
import { AgentsError } from '../../src/contract'
import { ProfilesStore } from '../../src/main/profiles/profiles-store'
import { DEFAULT_PROVIDERS, makeProviders, storeDeps } from '../support/builders'
import { perTestDb } from '../support/db'

const db = perTestDb()
const store = (providers = makeProviders()) => {
  const s = new ProfilesStore(db().db, providers, storeDeps())
  s.ensureBuiltinProfiles()
  return s
}
const summary = (s: ProfilesStore) => s.list().map((p) => [p.id, p.command, p.isDefault])
const expectCode = (fn: () => unknown, code: string) => expect(fn).toThrow(new AgentsError(code as never).message)

describe('ProfilesStore', () => {
  it('first run seeds Claude and OpenCode, Claude default', () => {
    expect(summary(store())).toEqual([
      ['builtin:claude', 'claude', true],
      ['builtin:opencode', 'opencode', false],
    ])
    const claude = store().get('builtin:claude')
    expect(claude).toMatchObject({
      name: null,
      displayNameKey: 'claude:provider.name',
      isBuiltin: true,
      available: true,
    })
    expect(claude).toMatchObject({ stockCommand: 'claude', stockArgs: [], args: [], commandOverride: null })
  })

  it('seeding is idempotent and keeps a user-changed default', () => {
    const s = store()
    s.setDefault('builtin:opencode')
    s.ensureBuiltinProfiles()
    expect(summary(store())).toEqual([
      ['builtin:claude', 'claude', false],
      ['builtin:opencode', 'opencode', true],
    ])
  })

  it('override and reset', () => {
    store().update('builtin:claude', { command: 'dgc', args: '--dangerously-skip-permissions', env: { FOO: 'bar' } })
    const p = store().get('builtin:claude')
    expect(p).toMatchObject({ command: 'dgc', args: ['--dangerously-skip-permissions'], commandOverride: 'dgc' })
    expect(p?.argsOverride).toBe('--dangerously-skip-permissions')
    const reset = store().reset('builtin:claude')
    expect(reset).toMatchObject({ command: 'claude', args: [], commandOverride: null, argsOverride: null })
    expect(reset.env).toEqual({ FOO: 'bar' })
  })

  it('values equal to the stock command line are not overrides', () => {
    const p = store().update('builtin:claude', { command: 'claude', args: '' })
    expect(p).toMatchObject({ commandOverride: null, argsOverride: null })
    expect(store().update('builtin:claude', { command: '  ' }).commandOverride).toBeNull()
  })

  it('argsInvalid on unterminated quote', () => {
    const s = store()
    expectCode(() => s.update('builtin:claude', { args: '--x "abc' }), 'argsInvalid')
    expect(s.get('builtin:claude')?.argsOverride).toBeNull()
  })

  it('envInvalid on a reserved key', () => {
    expectCode(() => store().update('builtin:claude', { env: { PRAGMA_X: '1' } }), 'envInvalid')
  })

  it.each([
    ['cannotDisableDefault', (s: ProfilesStore) => s.update('builtin:claude', { enabled: false })],
    [
      'cannotDefaultDisabled',
      (s: ProfilesStore) => {
        s.update('builtin:opencode', { enabled: false })
        s.setDefault('builtin:opencode')
      },
    ],
    [
      'cannotResetCustom',
      (s: ProfilesStore) => s.reset(s.create({ providerId: 'custom', name: 'C', command: 'c' }).id),
    ],
    ['cannotDeleteBuiltin', (s: ProfilesStore) => s.remove('builtin:opencode')],
    ['profileNotFound', (s: ProfilesStore) => s.update('nope', { enabled: true })],
  ])('guard %s', (code, act) => {
    const s = store()
    expectCode(() => act(s), code)
  })

  it('custom profile create/update/remove', () => {
    const s = store()
    const c = s.create({
      providerId: 'custom',
      name: ' Fake ',
      command: '/bin/fake',
      args: '--a "b c"',
      env: { K: 'v' },
    })
    expect(c).toMatchObject({
      name: 'Fake',
      command: '/bin/fake',
      args: ['--a', 'b c'],
      isBuiltin: false,
      sortOrder: 30,
    })
    expect(c).toMatchObject({ stockCommand: null, stockArgs: null, env: { K: 'v' }, available: true })
    expect(s.update(c.id, { name: 'Renamed', args: '-q' })).toMatchObject({ name: 'Renamed', args: ['-q'] })
    expect(s.create({ providerId: 'custom', name: 'Two', command: 'two' }).sortOrder).toBe(40)
    s.remove(c.id)
    expect(s.get(c.id)).toBeNull()
  })

  it('removing default custom reassigns default to claude', () => {
    const s = store()
    const c = s.create({ providerId: 'custom', name: 'C', command: 'c' })
    s.setDefault(c.id)
    expect(s.getDefault()?.id).toBe(c.id)
    s.remove(c.id)
    expect(s.getDefault()?.id).toBe('builtin:claude')
  })

  it('profile of an unregistered provider is unavailable', () => {
    store()
    const without = makeProviders(DEFAULT_PROVIDERS.filter((d) => d.id !== 'opencode'))
    const s = new ProfilesStore(db().db, without, storeDeps())
    expect(s.get('builtin:opencode')).toMatchObject({ available: false, displayNameKey: null })
    expect(s.list({ launchableOnly: true }).map((p) => p.id)).toEqual(['builtin:claude'])
  })

  it('launchableOnly hides disabled profiles and lists the default first', () => {
    const s = store()
    s.setDefault('builtin:opencode')
    s.create({ providerId: 'custom', name: 'C', command: 'c' })
    const off = s.create({ providerId: 'custom', name: 'D', command: 'd' })
    s.update(off.id, { enabled: false })
    expect(s.list({ launchableOnly: true }).map((p) => p.name ?? p.id)).toEqual([
      'builtin:opencode',
      'builtin:claude',
      'C',
    ])
  })

  it('listProviders returns only providers with launch, with seeded flag', () => {
    const providers = makeProviders([...DEFAULT_PROVIDERS, { id: 'nolaunch', command: 'x', noLaunch: true }])
    expect(
      store(providers)
        .listProviders()
        .map((p) => [p.id, p.seeded]),
    ).toEqual([
      ['claude', true],
      ['opencode', true],
      ['custom', false],
    ])
  })
})
