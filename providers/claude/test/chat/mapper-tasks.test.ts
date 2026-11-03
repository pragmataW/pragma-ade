import { describe, expect, it } from 'vitest'
import * as F from './frames'

const AGENT = 'toolu_agent_1'

describe('subagent output', () => {
  it('parent_tool_use_id becomes parentId on text, thinking, tool calls and edits', () => {
    const events = F.mapAll([
      F.inSubagent(F.assistant('sub', F.thinking('hm'))),
      F.inSubagent(F.assistant('sub', F.text('found'))),
      F.inSubagent(F.assistant('sub', F.editUse())),
    ])
    expect(events.map((e) => [e.kind, 'parentId' in e ? e.parentId : undefined])).toEqual([
      ['thinking', AGENT],
      ['text-delta', AGENT],
      ['tool-call', AGENT],
      ['file-edit', AGENT],
    ])
  })

  it('stream deltas of a subagent keep their own message id beside the main loop', () => {
    const events = F.mapAll([
      F.messageStart('main'),
      F.inSubagent(F.messageStart('sub')),
      F.blockStart(0, { type: 'text', text: '' }),
      F.inSubagent(F.blockStart(0, { type: 'text', text: '' })),
      F.textDelta(0, 'a'),
      F.inSubagent(F.textDelta(0, 'b')),
    ])
    expect(events).toEqual([
      { kind: 'text-delta', messageId: 'main', partId: 'main:0', text: 'a', mode: 'delta' },
      { kind: 'text-delta', messageId: 'sub', partId: 'sub:0', text: 'b', mode: 'delta', parentId: AGENT },
    ])
  })

  it('a subagent prompt (user text with a parent) is never a history message', () => {
    expect(F.mapAll([F.inSubagent(F.userText('p', 'List the files'))], { origin: 'history' })).toEqual([])
  })
})

describe('task frames', () => {
  it('task_started → running subagent task; progress adds summary, last tool and usage; notification ends it', () => {
    const events = F.mapAll([F.taskStarted(), F.taskProgress(), F.taskNotification()])
    expect(events).toEqual([
      {
        kind: 'task',
        taskId: 'task-1',
        toolCallId: AGENT,
        taskKind: 'subagent',
        name: 'general-purpose',
        description: 'List files',
        status: 'running',
        depth: 1,
      },
      expect.objectContaining({
        status: 'running',
        summary: 'Running ls',
        lastTool: 'Bash',
        usage: { tokens: 1200, toolUses: 2, durationMs: 900 },
      }),
      expect.objectContaining({ status: 'completed', summary: 'Two' }),
    ])
  })

  it('local_workflow → workflow named by workflow_name; nested task parentId = parent_task_id', () => {
    const events = F.mapAll([
      F.taskStarted({ task_id: 'wf', task_type: 'local_workflow', workflow_name: 'spec', subagent_type: undefined }),
      F.taskStarted({ task_id: 'child', parent_task_id: 'wf', spawn_depth: 2 }),
      F.taskStarted({ task_id: 'orphan', parent_task_id: 'unknown' }),
    ])
    expect(events[0]).toMatchObject({ taskKind: 'workflow', name: 'spec' })
    expect(events[1]).toMatchObject({ taskKind: 'subagent', parentId: 'wf', depth: 2 })
    expect(events[2]).not.toHaveProperty('parentId')
  })

  it('a backgrounded subagent stays a subagent; a foreground shell job shows once it moves to the background', () => {
    const events = F.mapAll([
      F.taskStarted({ task_id: 'bg', is_backgrounded: true }),
      F.taskStarted({ task_id: 'fg' }),
      F.taskUpdated({ is_backgrounded: true }, 'fg'),
      F.taskStarted({ task_id: 'sh', task_type: 'local_bash', subagent_type: undefined, tool_use_id: 'toolu_sh' }),
      F.taskUpdated({ is_backgrounded: true }, 'sh'),
      F.taskUpdated({ status: 'failed', error: 'exit 1' }, 'sh'),
    ])
    expect(events).toEqual([
      expect.objectContaining({ taskId: 'bg', taskKind: 'subagent', status: 'running' }),
      expect.objectContaining({ taskId: 'fg', taskKind: 'subagent', status: 'running' }),
      expect.objectContaining({ taskId: 'fg', taskKind: 'subagent' }),
      expect.objectContaining({ taskId: 'sh', taskKind: 'background', name: 'Bash', toolCallId: 'toolu_sh' }),
      expect.objectContaining({ taskId: 'sh', status: 'failed', summary: 'exit 1' }),
    ])
  })

  it.each([
    ['ambient', { ambient: true }],
    ['skip_transcript', { skip_transcript: true }],
  ])('%s tasks are hidden for their whole life', (_, flag) => {
    expect(F.mapAll([F.taskStarted(flag), F.taskProgress(), F.taskNotification()])).toEqual([])
  })

  it('notification stopped → killed; background_tasks_changed adds only unseen tasks', () => {
    const events = F.mapAll([
      F.taskStarted(),
      F.taskNotification({ status: 'stopped' }),
      F.system('background_tasks_changed', {
        tasks: [
          { task_id: 'task-1', task_type: 'local_agent', description: 'List files' },
          { task_id: 'late', task_type: 'local_bash', description: 'npm run dev' },
        ],
      }),
    ])
    expect(events.slice(1)).toEqual([
      expect.objectContaining({ taskId: 'task-1', status: 'killed' }),
      expect.objectContaining({
        taskId: 'late',
        taskKind: 'background',
        status: 'running',
        description: 'npm run dev',
      }),
    ])
  })
})

describe('notices', () => {
  it('rate_limit_event: warning with ms reset time and window utilization; allowed clears', () => {
    const events = F.mapAll([
      F.rateLimit({
        status: 'allowed_warning',
        resetsAt: 1_793_666_400,
        rateLimitType: 'five_hour',
        unifiedWindows: { five_hour: { utilization: 0.91 } },
      }),
      F.rateLimit({ status: 'allowed' }),
      F.rateLimit({ status: 'rejected', utilization: 100 }),
    ])
    expect(events).toEqual([
      { kind: 'rate-limit', status: 'warning', resetsAt: 1_793_666_400_000, window: 'five_hour', utilization: 0.91 },
      { kind: 'rate-limit', status: 'cleared' },
      { kind: 'rate-limit', status: 'rejected', utilization: 1 },
    ])
  })

  it('api_retry → retry; permission_denied → non-fatal error nested under its subagent', () => {
    const events = F.mapAll([
      F.system('api_retry', {
        attempt: 2,
        max_retries: 10,
        retry_delay_ms: 1500,
        error_status: 529,
        error: 'overloaded',
      }),
      F.system('permission_denied', { tool_name: 'Bash', message: 'Denied by rule', agent_id: 'task-1' }),
    ])
    expect(events).toEqual([
      { kind: 'retry', attempt: 2, maxAttempts: 10, delayMs: 1500, reason: 'overloaded' },
      { kind: 'error', code: 'unknown', message: 'Bash: Denied by rule', fatal: false, parentId: 'task-1' },
    ])
  })

  it('system/init with mcp_servers also emits mcp-status (unknown status → pending)', () => {
    const events = F.mapAll([
      F.system('init', {
        mcp_servers: [
          { name: 'graph', status: 'connected', source: 'user' },
          { name: 'odd', status: 'warming' },
        ],
      }),
    ])
    expect(events).toEqual([
      { kind: 'session-info', externalSessionId: 'sess-1' },
      {
        kind: 'mcp-status',
        servers: [
          { name: 'graph', status: 'connected', scope: 'user' },
          { name: 'odd', status: 'pending' },
        ],
      },
    ])
  })
})

describe('question / plan tool calls', () => {
  const frames = [
    F.assistant('m', F.toolUse('q1', 'AskUserQuestion', { questions: [] })),
    F.toolResult('q1', 'answered'),
  ]
  it('live: no tool row (the card stands for it); history: the tool row stays', () => {
    expect(F.mapAll(frames)).toEqual([])
    expect(F.mapAll(frames, { origin: 'history' }).map((e) => e.kind)).toEqual(['tool-call', 'tool-result'])
  })
})
