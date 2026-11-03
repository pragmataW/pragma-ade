import { describe, expect, it, vi } from 'vitest'
import { loadClaudeHistory } from '../../src/main/chat/history'
import { FAKE_TEXT, FAKE_WORKFLOW_AGENT } from '../../testing/fake-claude-stream/scenario'
import { isKind, ofKind, profileFor, startSession, tempClaudeHome } from './support'

async function recordedSession(scenario: Parameters<typeof startSession>[0] = 'todo', prompt = 'make a plan') {
  const home = tempClaudeHome()
  vi.stubEnv('HOME', home.home)
  vi.stubEnv('CLAUDE_CONFIG_DIR', home.configDir)
  const s = await startSession(scenario, { home })
  await s.send(prompt)
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

  it('a workflow agent transcript (subagents/workflows/<run>/, no tool call in a sidecar) nests under the Workflow call', async () => {
    const { s, home } = await recordedSession('workflow-agent', 'run the workflow')
    const events = await loadClaudeHistory({
      profile: profileFor('claude'),
      worktreePath: home.worktree,
      env: {},
      externalSessionId: s.session.externalSessionId,
    })
    expect(ofKind(events, 'message').map((e) => e.text)).toEqual(['run the workflow'])
    expect(events.find(isKind('text-delta', (e) => e.text === FAKE_WORKFLOW_AGENT.reply))).toMatchObject({
      parentId: FAKE_WORKFLOW_AGENT.toolId,
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
