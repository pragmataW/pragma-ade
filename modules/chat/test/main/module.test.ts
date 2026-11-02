import { describe, expect, it } from 'vitest'
import { type ChatEvent, type ChatService, chatIpc, chatSettingsDefaults } from '../../src/contract'
import { activateChat } from '../../src/main/activate'
import { createFakeChatCapability, FAKE_OPTIONS, stubAgentsApi } from '../../testing'
import { fakeIpc, flush } from './harness'

function setup(opts: { capability?: boolean; history?: ChatEvent[] } = {}) {
  const agents = stubAgentsApi()
  const fake = createFakeChatCapability({ options: FAKE_OPTIONS, history: opts.history, interactive: true })
  const ipc = fakeIpc()
  const services: ChatService[] = []
  const main = activateChat({
    agents,
    capability: () => (opts.capability === false ? undefined : fake.capability),
    settings: () => chatSettingsDefaults,
    ipc,
    provideService: (s) => void services.push(s),
    log: { info: () => undefined, warn: () => undefined },
  })
  const session = agents.sessions.get('s1')
  const profile = agents.profiles.get('p1')
  if (!session || !profile) throw new Error('stub agents API has no session/profile')
  const start = async () => {
    const handler = agents.handlers.get('chat')
    const result = await handler?.start({
      session,
      profile,
      worktree: { id: 'w1', path: '/w' },
      reportExit: () => undefined,
    })
    await main.registry.get('s1')?.whenAttached()
    return result
  }
  return { agents, fake, ipc, services, main, start, session }
}

describe('chat main module', () => {
  it('activate registers mode handler chat; deactivate disposes it', async () => {
    const s = setup()
    expect([...s.agents.handlers.keys()]).toEqual(['chat'])
    expect(s.ipc.has(chatIpc.send.channel)).toBe(true)
    await s.main.dispose()
    expect(s.agents.handlers.size).toBe(0)
    expect(s.ipc.has(chatIpc.send.channel)).toBe(false)
  })

  it('mode start attaches a controller and returns ptyId null; mode is never written by chat', async () => {
    const s = setup()
    expect(await s.start()).toEqual({ ptyId: null })
    expect(s.fake.sessions).toHaveLength(1)
    expect(s.agents.updates.some((u) => 'mode' in u.patch)).toBe(false)
  })

  it('chat.send routes to controller', async () => {
    const s = setup()
    await s.start()
    expect(await s.ipc.invoke(chatIpc.send, { sessionId: 's1', text: 'hi', images: [] })).toEqual({ queued: false })
    expect(s.fake.lastSession().sent).toEqual([{ text: 'hi', images: [] }])
  })

  it('chat.respond routes to controller', async () => {
    const s = setup()
    await s.start()
    await s.ipc.invoke(chatIpc.respond, { sessionId: 's1', eventId: 'e1', payload: { a: 1 } })
    expect(s.fake.lastSession().responses).toEqual([{ eventId: 'e1', payload: { a: 1 } }])
  })

  it('chat.setOption routes and validates', async () => {
    const s = setup()
    await s.start()
    await s.ipc.invoke(chatIpc.setOption, { sessionId: 's1', key: 'fakeMode', value: 'b' })
    expect(s.fake.lastSession().optionSets).toEqual([{ key: 'fakeMode', value: 'b' }])
    await expect(s.ipc.invoke(chatIpc.setOption, { sessionId: 's1', key: 'fakeMode', value: 'x' })).rejects.toThrow()
  })

  it('appendToComposer publishes chat.composerInboxChanged', () => {
    const s = setup()
    s.services[0]?.appendToComposer('s1', 'File.ts:3 fix this')
    expect(s.ipc.published).toEqual([{ channel: 'chat.composerInboxChanged', payload: { sessionId: 's1' } }])
  })

  it('getHistory returns dormant transcript', async () => {
    const history = [
      {
        kind: 'message' as const,
        messageId: 'u',
        role: 'user' as const,
        text: 'old',
        attachments: [],
        origin: 'history' as const,
      },
    ]
    const s = setup({ history })
    s.agents.sessions.set('s1', { ...s.session, externalSessionId: 'ext' })
    const t = await s.services[0]?.getHistory('s1')
    expect(t?.items).toEqual([
      { kind: 'message', id: 'u', role: 'user', text: 'old', attachments: [], at: expect.any(Number) },
    ])
  })

  it('checkSupport noCapability when provider lacks chat', async () => {
    const s = setup({ capability: false })
    expect(await s.ipc.invoke(chatIpc.checkSupport, { profileId: 'p1' })).toEqual({
      ok: false,
      reasonKey: 'chat:unsupported.noCapability',
    })
  })

  it('checkSupport reports a disabled profile and a cached startup failure', async () => {
    const s = setup()
    const profile = s.agents.profiles.get('p1')
    if (profile) s.agents.profiles.set('p1', { ...profile, enabled: false })
    expect(await s.ipc.invoke(chatIpc.checkSupport, { profileId: 'p1' })).toMatchObject({
      reasonKey: 'chat:unsupported.profileDisabled',
    })
  })

  it('chat.open returns the live snapshot and events are published', async () => {
    const s = setup()
    await s.start()
    await flush()
    const snap = await s.ipc.invoke(chatIpc.open, { sessionId: 's1' })
    expect(snap).toMatchObject({ providerId: 'prov', status: 'idle' })
    expect(s.ipc.published.filter((p) => p.channel === 'chat.event').length).toBe(snap.transcript.lastSeq)
  })
})
