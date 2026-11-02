import { aSession } from '@pragma/module-agents/testing'
import { describe, expect, it } from 'vitest'
import { createSessionInfo } from '../src/main/session-info'
import { fakeAgentSessions, fakeStatus } from './support/fakes'

const sessions = fakeAgentSessions()
sessions.add(aSession('s1', 1, { profileId: 'fake', providerId: 'custom', title: 'Fix login', createdAt: 1234 }))

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

  it('an ended session (error: never launched) shows its 03 status over a stale agent-status one', async () => {
    const own = fakeAgentSessions()
    own.add(aSession('s2', 2, { status: 'error', error: { code: 'commandNotFound', message: 'x' } }))
    const map = new Map([['s2', { status: 'working' as const, turnCompleted: false }]])
    const info = createSessionInfo({ sessions: own.service, status: fakeStatus(map).service })
    expect((await info.describe(['s2']))[0]?.status).toBe('error')
  })

  it('a failed turn (03 row idle, f76254c) is still a live session: the agent-status status wins', async () => {
    const own = fakeAgentSessions()
    own.add(aSession('s3', 3, { status: 'idle' }))
    const map = new Map([['s3', { status: 'error' as const, turnCompleted: true }]])
    const info = createSessionInfo({ sessions: own.service, status: fakeStatus(map).service })
    expect((await info.describe(['s3']))[0]?.status).toBe('error')
  })

  it('fills profile name, provider, title and start time', async () => {
    const [s] = await createSessionInfo({ sessions: sessions.service }).describe(['s1'])
    expect(s).toMatchObject({
      profileName: 'Fake',
      providerId: 'custom',
      title: 'Fix login',
      profileId: 'fake',
      startedAt: 1234,
    })
  })
})
