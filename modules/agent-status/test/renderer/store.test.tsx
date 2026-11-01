import { describe, expect, it } from 'vitest'
import { useAgentStatusStore } from '../../src/renderer/store'
import { sessionInfo } from '../support/builders'
import '../support/render'

describe('renderer status store', () => {
  it('hydrates and upserts; events received before hydration win', () => {
    const s = useAgentStatusStore.getState()
    s.upsertSession(sessionInfo({ sessionId: 'a', status: 'waiting' }))
    s.hydrate({
      sessions: [sessionInfo({ sessionId: 'a', status: 'working' }), sessionInfo({ sessionId: 'b' })],
      worktrees: [{ worktreeId: 'w1', status: 'working', turnCompleted: false, unreadCount: 0, sessionCount: 2 }],
    })
    s.upsertWorktree({ worktreeId: 'w1', status: 'waiting', turnCompleted: false, unreadCount: 1, sessionCount: 2 })
    const state = useAgentStatusStore.getState()
    expect(state.sessions.a?.status).toBe('waiting')
    expect(Object.keys(state.sessions)).toEqual(['a', 'b'])
    expect(state.worktrees.w1?.unreadCount).toBe(1)
  })
})
