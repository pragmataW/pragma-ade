import { describe, expect, it } from 'vitest'
import { chatIpc, chatSettingsDefaults } from '../../src/contract'
import { activateChat } from '../../src/main/activate'
import { ChatSessionController } from '../../src/main/controller'
import { createFakeChatCapability, stubAgentsApi } from '../../testing'
import { fakeIpc, flush, harness } from './harness'

const RESUME = { externalSessionId: 'ext-1' }
const BUSY = 'chat-switch:reason.busy'
const input = (text: string) => ({ text, images: [] })

/** The chat main module over stubs: the mode handler, the service and the IPC. */
function activated() {
  const agents = stubAgentsApi()
  const fake = createFakeChatCapability()
  const ipc = fakeIpc()
  const main = activateChat({
    agents,
    capability: () => fake.capability,
    settings: () => chatSettingsDefaults,
    ipc,
    provideService: () => undefined,
    log: { info: () => undefined, warn: () => undefined },
  })
  return { agents, fake, ipc, main }
}

type Activated = ReturnType<typeof activated>

/** 03's mode-handler `start` with `resume`, awaited until the handshake settled. */
async function startResumed(agents: Activated['agents'], main: Activated['main']) {
  const session = agents.sessions.get('s1')
  const profile = agents.profiles.get('p1')
  if (!session || !profile) throw new Error('stub has no session')
  await agents.handlers.get('chat')?.start({
    session,
    profile,
    worktree: { id: 'w1', path: '/w' },
    resume: RESUME,
    reportExit: () => undefined,
  })
  await main.registry.get('s1')?.whenAttached()
}

describe('chat support for 11c', () => {
  it('mode handler start with resume passes resumeExternalSessionId', async () => {
    const { agents, fake, main } = activated()
    await startResumed(agents, main)
    expect(fake.lastSession().createdWith.resumeExternalSessionId).toBe(RESUME.externalSessionId)
    expect(agents.envRequests.at(-1)).toEqual({ sessionId: 's1', resume: RESUME })
  })

  it.each([
    [
      'resume start',
      async (c: ChatSessionController, h: ReturnType<typeof harness>) => c.attach(h.request({ resume: RESUME })),
    ],
    [
      'dormant send',
      async (c: ChatSessionController, h: ReturnType<typeof harness>) => {
        await c.send(input('again'))
        expect(h.agents.relaunches.at(-1)?.opts.resume).toEqual(RESUME)
        await c.attach(h.request({ resume: RESUME }))
      },
    ],
  ])('start guard blocks %s', async (_name, run) => {
    const h = harness()
    const seen: unknown[] = []
    const c = new ChatSessionController({
      ...h.deps,
      sessionId: h.session.id,
      startGuard: (s) => {
        seen.push(s)
        return { ok: false, reasonKey: BUSY }
      },
    })
    c.initDormant([], 'exited', { providerId: h.profile.providerId, externalSessionId: RESUME.externalSessionId })
    await run(c, h)
    await flush()
    expect(h.fake.sessions).toHaveLength(0)
    expect(seen).toEqual([{ sessionId: h.session.id, providerId: h.profile.providerId, externalSessionId: 'ext-1' }])
    expect(h.published.map((p) => p.event)).toContainEqual(
      expect.objectContaining({ kind: 'error', message: BUSY, fatal: true }),
    )
    expect(h.exits).toEqual([null])
  })

  it('a start without resume skips the guards', async () => {
    const h = harness()
    const c = new ChatSessionController({
      ...h.deps,
      sessionId: h.session.id,
      startGuard: () => ({ ok: false, reasonKey: BUSY }),
    })
    await c.attach(h.request())
    expect(h.fake.sessions).toHaveLength(1)
  })

  it('inbox keeps entries until taken', async () => {
    const { ipc, main } = activated()
    main.service.appendToComposer('s1', 'plain')
    main.service.appendToComposer('s1', 'Review comments:\n1. x', { chipLabels: ['a.ts:1', 'b.ts:2'] })
    expect(ipc.published.map((p) => p.channel)).toEqual(['chat.composerInboxChanged', 'chat.composerInboxChanged'])
    const { entries } = await ipc.invoke(chatIpc.takeComposerInbox, { sessionId: 's1' })
    expect(entries.map((e) => [e.kind, e.text])).toEqual([
      ['text', 'plain'],
      ['chip', 'Review comments:\n1. x'],
    ])
    expect(entries[1]).toMatchObject({ labels: ['a.ts:1', 'b.ts:2'] })
    expect((await ipc.invoke(chatIpc.takeComposerInbox, { sessionId: 's1' })).entries).toEqual([])
  })

  it('a guard registered on the service refuses resumes until unregistered', async () => {
    const { agents, fake, main } = activated()
    const off = main.service.registerStartGuard(() => ({ ok: false, reasonKey: BUSY }))
    await startResumed(agents, main)
    expect(fake.sessions).toHaveLength(0)
    off()
    await startResumed(agents, main)
    expect(fake.sessions).toHaveLength(1)
  })
})
