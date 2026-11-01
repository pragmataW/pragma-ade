import { aSession } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createSessionInfo } from '../src/main/session-info'
import { fakeAgentSessions, fakeStatus } from './support/fakes'

const sessions = fakeAgentSessions()
sessions.add(aSession('s1', 1, { profileId: 'fake', providerId: 'custom', title: 'Fix login' }))

describe('createSessionInfo', () => {
  it('skips missing sessions', async () => {
    const info = createSessionInfo({ sessions: sessions.service })
    expect((await info.describe(['s1', 'gone'])).map((s) => s.sessionId)).toEqual(['s1'])
  })

  it('has no status when agent-status is absent', async () => {
    const info = createSessionInfo({ sessions: sessions.service })
    expect(info.statusAvailable).toBe(false)
    expect((await info.describe(['s1']))[0]).toMatchObject({ status: null, turnCompleted: false })
  })

  it.each([
    [new Map([['s1', { status: 'waiting' as const, turnCompleted: false }]]), 'waiting'],
    [new Map(), null],
  ])('reads the status from agent-status (%#)', async (map, status) => {
    const info = createSessionInfo({ sessions: sessions.service, status: fakeStatus(map).service })
    expect(info.statusAvailable).toBe(true)
    expect((await info.describe(['s1']))[0]?.status).toBe(status)
  })

  it('fills profile name, provider and title', async () => {
    const [s] = await createSessionInfo({ sessions: sessions.service }).describe(['s1'])
    expect(s).toMatchObject({ profileName: 'Fake', providerId: 'custom', title: 'Fix login', profileId: 'fake' })
  })
})
