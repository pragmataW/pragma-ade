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

  it('workflow agents (no spawning tool call in their sidecar) nest under the Workflow call that ran before them', async () => {
    const at = (t: string) => ({ timestamp: `2026-11-03T10:00:${t}.000Z` })
    const harness = '[Workflow harness — computed task] The task text below was computed at runtime…\n  sleep 20'
    sdk.getSessionMessages.mockResolvedValue([
      { ...F.userText('u1', 'run the workflow'), ...at('00') },
      { ...F.assistant('m1', F.toolUse('toolu_wf_1', 'Workflow', { script: 'a' })), ...at('01') },
      { ...F.toolResult('toolu_wf_1', 'started'), ...at('02') },
      { ...F.assistant('m2', F.toolUse('toolu_wf_2', 'Workflow', { script: 'b' })), ...at('30') },
    ])
    sdk.listSubagents.mockResolvedValue(['wf-agent-a', 'wf-agent-b'])
    const agentRun = (id: string, t: string) => [
      { ...F.userText(`${id}-p`, harness), ...at(t) },
      { ...F.assistant(`${id}-1`, F.toolUse(`${id}-bash`, 'Bash', { command: 'sleep 20' })), ...at(t) },
      { ...F.toolResult(`${id}-bash`, ''), ...at(t) },
      { ...F.assistant(`${id}-2`, F.text('workflow agent tamam: 20sn bekledim')), ...at(t) },
    ]
    sdk.getSubagentMessages.mockImplementation(async (_s: string, agent: string) =>
      agent === 'wf-agent-a' ? agentRun('a', '05') : agentRun('b', '31'),
    )
    const events = await loadClaudeHistory(ctx)
    expect(events.filter((e) => e.kind === 'message').map((e) => 'text' in e && e.text)).toEqual(['run the workflow'])
    const under = (parent: string) =>
      events
        .filter((e) => 'parentId' in e && e.parentId === parent)
        .map((e) => [e.kind, 'toolCallId' in e && e.toolCallId])
    expect(under('toolu_wf_1')).toEqual([
      ['tool-call', 'a-bash'],
      ['text-delta', false],
    ])
    expect(under('toolu_wf_2')).toEqual([
      ['tool-call', 'b-bash'],
      ['text-delta', false],
    ])
    expect(events.filter((e) => e.kind === 'text-delta' && !('parentId' in e && e.parentId))).toEqual([])
  })

  it('an orphan subagent transcript with no Workflow call to nest under is left out', async () => {
    sdk.getSessionMessages.mockResolvedValue([F.userText('u1', 'hi')])
    sdk.listSubagents.mockResolvedValue(['lost'])
    sdk.getSubagentMessages.mockResolvedValue([F.userText('p', 'computed task'), F.assistant('s', F.text('done'))])
    expect((await loadClaudeHistory(ctx)).map((e) => e.kind)).toEqual(['message'])
  })

  it('a failing subagent listing still loads the main transcript', async () => {
    sdk.getSessionMessages.mockResolvedValue([F.userText('u1', 'hi')])
    sdk.listSubagents.mockRejectedValue(new Error('no dir'))
    expect((await loadClaudeHistory(ctx)).map((e) => e.kind)).toEqual(['message'])
  })
})
