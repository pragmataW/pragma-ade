import { makeLaunchContext } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createStatusLaunchDecorator } from '../src/main/launch-decorator'
import { fakeBridge, fakeStatusCapability, storeHarness } from './support/fakes'

const spec = () => ({ command: 'agent', args: ['--x'], env: { A: '1' }, cwd: '/w' })
const ctx = (over: Parameters<typeof makeLaunchContext>[0] = {}) =>
  makeLaunchContext({ sessionId: 's1', worktreeId: 'w1', ...over })

function decorator(o: { bridge?: boolean; cap?: ReturnType<typeof fakeStatusCapability>['cap'] | null } = {}) {
  const h = storeHarness()
  const fake = fakeStatusCapability()
  const cap = o.cap === undefined ? fake.cap : (o.cap ?? undefined)
  const d = createStatusLaunchDecorator({
    bridge: () => (o.bridge === false ? undefined : fakeBridge()),
    statusCapability: () => cap,
    store: h.store,
    log: h.log,
  })
  return { d, h, calls: fake.calls }
}

describe('status launch decorator', () => {
  it('adds bridge env and calls the capability with bridgeUrl/bridgeToken', async () => {
    const { d, h, calls } = decorator()
    const out = await d.decorate(spec(), ctx())
    expect(out.env).toEqual({ A: '1', PRAGMA_BRIDGE_URL: 'http://127.0.0.1:4000', PRAGMA_BRIDGE_TOKEN: 'tok' })
    expect(out.args).toEqual(['--hooked', '--x'])
    expect(calls[0]).toMatchObject({ bridgeUrl: 'http://127.0.0.1:4000', bridgeToken: 'tok' })
    expect(h.store.get('s1')?.source).toBe('pending-hooks')
  })

  it('no capability → env only, activity', async () => {
    const { d, h } = decorator({ cap: null })
    const out = await d.decorate(spec(), ctx())
    expect(out.args).toEqual(['--x'])
    expect(out.env.PRAGMA_BRIDGE_TOKEN).toBe('tok')
    expect(h.store.get('s1')?.source).toBe('activity')
  })

  it('no bridge → spec unchanged, activity', async () => {
    const { d, h } = decorator({ bridge: false })
    expect(await d.decorate(spec(), ctx())).toEqual(spec())
    expect(h.store.get('s1')?.source).toBe('activity')
  })

  it('capability throws → env only, activity, warning', async () => {
    const { cap } = fakeStatusCapability({
      decorateLaunch: async () => {
        throw new Error('nope')
      },
    })
    const { d, h } = decorator({ cap })
    const out = await d.decorate(spec(), ctx())
    expect(out.args).toEqual(['--x'])
    expect(out.env.PRAGMA_BRIDGE_URL).toBeDefined()
    expect(h.store.get('s1')?.source).toBe('activity')
    expect(h.log.messages('warn')).toHaveLength(1)
  })

  it("ctx.mode 'chat' → env only, external, capability not called", async () => {
    const { d, h, calls } = decorator()
    const out = await d.decorate(spec(), ctx({ mode: 'chat' }))
    expect(out.args).toEqual(['--x'])
    expect(calls).toEqual([])
    expect(h.store.get('s1')?.source).toBe('external')
  })
})
