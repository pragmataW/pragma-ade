import { describe, expect, it, vi } from 'vitest'
import { loadClaudeHistory } from '../../src/main/chat/history'
import { FAKE_TEXT } from '../../testing/fake-claude-stream/scenario'
import { isKind, profileFor, startSession, tempClaudeHome } from './support'

async function recordedSession() {
  const home = tempClaudeHome()
  vi.stubEnv('HOME', home.home)
  vi.stubEnv('CLAUDE_CONFIG_DIR', home.configDir)
  const s = await startSession('todo', { home })
  await s.send('make a plan')
  await s.waitForEvent(isKind('turn-end'))
  await s.session.close()
  return { s, home }
}

describe('loadClaudeHistory', () => {
  it('loads transcript: history message + text snapshot + completed tool', async () => {
    const { s, home } = await recordedSession()
    const events = await loadClaudeHistory({
      profile: profileFor('claude'),
      worktreePath: home.worktree,
      env: {},
      externalSessionId: s.session.externalSessionId,
    })
    expect(events.find(isKind('message'))).toMatchObject({ text: 'make a plan', origin: 'history' })
    expect(events.find(isKind('text-delta'))).toMatchObject({ text: FAKE_TEXT.todo, mode: 'snapshot' })
    expect(events.find(isKind('tool-call'))).toMatchObject({ name: 'TodoWrite', status: 'running' })
    expect(events.find(isKind('tool-result'))).toMatchObject({ status: 'completed' })
    expect(events.find(isKind('todo'))).toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ status: 'active' })]),
    })
  })

  it('worktree path with spaces/unicode loads via fallback', async () => {
    const { s } = await recordedSession()
    const events = await loadClaudeHistory({
      profile: profileFor('claude'),
      worktreePath: '/some/other path ü',
      env: {},
      externalSessionId: s.session.externalSessionId,
    })
    expect(events.find(isKind('message'))).toMatchObject({ text: 'make a plan' })
  })
})
