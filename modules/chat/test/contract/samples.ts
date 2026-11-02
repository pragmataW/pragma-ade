import type { ChatEvent, ChatEventKind } from '../../src/contract'

/** One valid sample per event kind (a new kind without a sample fails `events.test.ts`). */
export const EVENT_SAMPLES: Record<ChatEventKind, ChatEvent> = {
  'session-info': { kind: 'session-info', externalSessionId: 'ext', commands: [{ name: 'help', description: 'Help' }] },
  options: {
    kind: 'options',
    options: [
      {
        key: 'model',
        type: 'enum',
        labelKey: 'chat:option.model',
        values: [{ value: null }],
        default: null,
        current: null,
      },
    ],
  },
  message: { kind: 'message', messageId: 'm1', role: 'user', text: 'hi', attachments: [], origin: 'live' },
  'turn-start': { kind: 'turn-start', turnId: 't1' },
  'text-delta': { kind: 'text-delta', messageId: 'a1', partId: 'a1:0', text: 'He', mode: 'delta' },
  thinking: { kind: 'thinking', messageId: 'a1', partId: 'a1:1', text: 'hmm', mode: 'snapshot' },
  'tool-call': { kind: 'tool-call', toolCallId: 'tc1', name: 'Run', toolKind: 'shell', input: {}, status: 'pending' },
  'tool-result': { kind: 'tool-result', toolCallId: 'tc1', status: 'completed', output: 'ok' },
  'file-edit': { kind: 'file-edit', path: 'a.ts', change: 'edit', hunks: [{ before: 'a', after: 'b' }] },
  todo: { kind: 'todo', items: [{ id: '0', text: 'Do', status: 'active' }] },
  'permission-request': {
    kind: 'permission-request',
    requestId: 'r1',
    toolName: 'Run',
    toolKind: 'shell',
    title: 'ls',
    input: {},
    options: ['allow_once', 'deny'],
  },
  'permission-resolved': { kind: 'permission-resolved', requestId: 'r1', outcome: 'allowed' },
  usage: { kind: 'usage', inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0.01 },
  error: { kind: 'error', code: 'unknown', message: 'boom', fatal: false },
  'turn-end': { kind: 'turn-end', reason: 'completed' },
  'session-exit': { kind: 'session-exit', exitCode: 0, reason: 'closed' },
  queue: { kind: 'queue', queued: [{ id: 'q1', text: 'next' }] },
  custom: { kind: 'custom', type: 'fake.banner', data: { message: 'x' } },
  'response-resolved': { kind: 'response-resolved', eventId: 'e1', outcome: 'answered' },
  task: {
    kind: 'task',
    taskId: 'task1',
    toolCallId: 'tc1',
    taskKind: 'subagent',
    name: 'Explore',
    description: 'Find the config',
    status: 'running',
    lastTool: 'Grep',
    usage: { tokens: 1200, costUsd: 0.02 },
    depth: 1,
  },
  question: {
    kind: 'question',
    eventId: 'q1',
    questions: [
      {
        question: 'Which database?',
        header: 'DB',
        multiSelect: false,
        options: [{ label: 'Postgres', description: 'Relational' }, { label: 'SQLite' }],
      },
    ],
  },
  'plan-proposal': { kind: 'plan-proposal', eventId: 'p1', plan: '# Plan\n\n1. Do it', modes: ['acceptEdits'] },
  'mcp-status': {
    kind: 'mcp-status',
    servers: [
      { name: 'github', status: 'connected', toolCount: 12 },
      { name: 'db', status: 'failed', error: 'ECONNREFUSED' },
    ],
  },
  'rate-limit': { kind: 'rate-limit', status: 'warning', resetsAt: 1_700_000_000_000, utilization: 0.9 },
  retry: { kind: 'retry', attempt: 2, maxAttempts: 5, delayMs: 2000, reason: 'overloaded' },
}
