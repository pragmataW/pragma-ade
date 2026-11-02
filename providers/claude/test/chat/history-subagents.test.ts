import { describe, expect, it, vi } from 'vitest'
import { loadClaudeHistory } from '../../src/main/chat/history'
import * as F from './frames'
import { profileFor } from './support'

const AGENT = 'toolu_agent_1'
const sdk = vi.hoisted(() => ({
  getSessionMessages: vi.fn(),
  listSubagents: vi.fn(),
  getSubagentMessages: vi.fn(),
}))
vi.mock('@anthropic-ai/claude-agent-sdk', () => sdk)

const ctx = { profile: profileFor('claude'), worktreePath: '/w', env: {}, externalSessionId: 'sess-1' }

describe('loadClaudeHistory: subagents', () => {
  it('replays each subagent transcript nested under its Agent tool call (its prompt is not a user message)', async () => {
    sdk.getSessionMessages.mockResolvedValue([
      F.userText('u1', 'look around'),
      F.assistant('m1', F.toolUse(AGENT, 'Agent', { description: 'List files', prompt: 'ls' })),
      F.toolResult(AGENT, 'done'),
    ])
    sdk.listSubagents.mockResolvedValue(['agent-1'])
    sdk.getSubagentMessages.mockResolvedValue([
      F.inSubagent(F.userText('s0', 'ls')),
      F.inSubagent(F.assistant('s1', F.toolUse('toolu_ls', 'Bash', { command: 'ls' }))),
      F.inSubagent(F.toolResult('toolu_ls', 'a.txt')),
      F.inSubagent(F.assistant('s2', F.text('One file.'))),
    ])
    const events = await loadClaudeHistory(ctx)
    expect(sdk.getSubagentMessages).toHaveBeenCalledWith('sess-1', 'agent-1', { dir: '/w' })
    expect(events.filter((e) => e.kind === 'message')).toHaveLength(1)
    const nested = events.filter((e) => 'parentId' in e && e.parentId === AGENT)
    expect(nested.map((e) => e.kind)).toEqual(['tool-call', 'text-delta'])
  })

  it('a failing subagent listing still loads the main transcript', async () => {
    sdk.getSessionMessages.mockResolvedValue([F.userText('u1', 'hi')])
    sdk.listSubagents.mockRejectedValue(new Error('no dir'))
    expect((await loadClaudeHistory(ctx)).map((e) => e.kind)).toEqual(['message'])
  })
})
