import { describe, expect, it } from 'vitest'
import {
  type ChatEvent,
  type ChatTranscript,
  childItems,
  emptyTranscript,
  itemKey,
  reduceEvents,
  reduceTranscript,
  type ToolCallItem,
  taskOfToolCall,
} from '../../src/contract'
import { makeEnvelope, makeEnvelopes, makeTranscript, TEST_AT } from '../../testing'
import { EVENT_SAMPLES as E } from './samples'

const text = (t: string, mode: 'delta' | 'snapshot' = 'delta'): ChatEvent => ({
  kind: 'text-delta',
  messageId: 'a1',
  partId: 'a1:0',
  text: t,
  mode,
})
const tool = (status: 'pending' | 'running', extra: Partial<ToolCallItem> = {}): ChatEvent =>
  ({ kind: 'tool-call', toolCallId: 'tc1', name: 'Run', toolKind: 'shell', input: {}, status, ...extra }) as ChatEvent
const only = (t: ChatTranscript) => {
  expect(t.items).toHaveLength(1)
  return t.items[0]
}
const awaiting: ChatEvent = { kind: 'custom', type: 'fake.form', data: {}, eventId: 'e1', awaitsResponse: true }

describe('reduceTranscript', () => {
  it('text deltas append; snapshot replaces and stops streaming', () => {
    expect(only(makeTranscript([text('Hel'), text('lo')]))).toMatchObject({ text: 'Hello', streaming: true })
    expect(only(makeTranscript([text('Hel'), text('Hello!', 'snapshot')]))).toMatchObject({
      text: 'Hello!',
      streaming: false,
    })
  })

  it('tool-call upserts by toolCallId; tool-result merges status/output into the same item', () => {
    const t = makeTranscript([
      tool('pending'),
      tool('running', { input: { command: 'ls' }, title: 'ls' }),
      {
        kind: 'tool-call',
        toolCallId: 'tc1',
        name: 'Run',
        toolKind: 'shell',
        input: { command: 'ls' },
        status: 'running',
      },
      E['tool-result'],
    ])
    expect(only(t)).toMatchObject({ status: 'completed', output: 'ok', title: 'ls', input: { command: 'ls' } })
  })

  it('file-edit and todo upsert by toolCallId', () => {
    const todo = (status: 'active' | 'done'): ChatEvent => ({
      kind: 'todo',
      toolCallId: 'tw',
      items: [{ id: '0', text: 'x', status }],
    })
    const edit = (after: string): ChatEvent => ({
      kind: 'file-edit',
      toolCallId: 'ed',
      path: 'a',
      change: 'edit',
      hunks: [{ before: 'a', after }],
    })
    const t = makeTranscript([todo('active'), edit('b'), todo('done'), edit('c')])
    expect(t.items).toHaveLength(2)
    expect(t.items[0]).toMatchObject({ id: 'todo:tw', items: [{ status: 'done' }] })
    expect(t.items[1]).toMatchObject({ id: 'edit:ed', hunks: [{ after: 'c' }] })
  })

  it('permission-request then permission-resolved sets outcome and pendingInteractions back to 0', () => {
    expect(makeTranscript([E['permission-request']]).pendingInteractions).toBe(1)
    const t = makeTranscript([E['permission-request'], E['permission-resolved']])
    expect(only(t)).toMatchObject({ kind: 'permission-request', id: 'r1', outcome: 'allowed' })
    expect(t.pendingInteractions).toBe(0)
  })

  it('custom awaitsResponse increments pendingInteractions; response-resolved marks the item resolved and decrements', () => {
    expect(makeTranscript([awaiting]).pendingInteractions).toBe(1)
    const t = makeTranscript([awaiting, E['response-resolved']])
    expect(only(t)).toMatchObject({ kind: 'custom', id: 'e1', resolved: 'answered' })
    expect(t.pendingInteractions).toBe(0)
  })

  it('turn-end interrupted adds a turn-end item and clears streaming flags; completed adds no item', () => {
    const interrupted = makeTranscript([E['turn-start'], text('a'), { kind: 'turn-end', reason: 'interrupted' }])
    expect(interrupted.items.map((i) => i.kind)).toEqual(['text-delta', 'turn-end'])
    expect(interrupted.items[0]).toMatchObject({ streaming: false })
    expect(makeTranscript([E['turn-start'], text('a'), E['turn-end']]).items).toHaveLength(1)
  })

  it('custom events become custom items with type and data', () => {
    expect(only(makeTranscript([E.custom]))).toMatchObject({
      kind: 'custom',
      type: 'fake.banner',
      data: { message: 'x' },
      awaitsResponse: false,
    })
  })

  it('options replaces info.options; session-info merges; usage replaces; queue replaces', () => {
    const t = makeTranscript([
      E['session-info'],
      { kind: 'session-info', commands: [{ name: 'x', description: '' }] },
      E.options,
      E.usage,
      { ...E.usage, inputTokens: 9 } as ChatEvent,
      E.queue,
      { kind: 'queue', queued: [] },
    ])
    expect(t.info).toMatchObject({ externalSessionId: 'ext', commands: [{ name: 'x' }], options: [{ key: 'model' }] })
    expect(t.usage).toMatchObject({ inputTokens: 9 })
    expect(t.queue).toEqual([])
  })

  it('ignores envelopes with seq <= lastSeq', () => {
    const envs = makeEnvelopes([text('a'), text('b')])
    const once = envs.reduce(reduceTranscript, emptyTranscript())
    expect(envs.reduce(reduceTranscript, once)).toBe(once)
    expect(reduceTranscript(once, makeEnvelope(text('c'), 2))).toEqual(once)
  })

  it('snapshot plus tail equals full replay', () => {
    const events: ChatEvent[] = [
      E.message,
      E['turn-start'],
      text('He'),
      tool('pending'),
      E['permission-request'],
      text('llo'),
      E['permission-resolved'],
      E['tool-result'],
      E.usage,
      E['turn-end'],
    ]
    const envs = makeEnvelopes(events)
    const snapshot = envs.slice(0, 6).reduce(reduceTranscript, emptyTranscript())
    expect(envs.reduce(reduceTranscript, snapshot)).toEqual(makeTranscript(events))
  })

  it('turn-start sets turnActive and turnStartedAt = env.at; turn-end clears both', () => {
    const started = reduceTranscript(emptyTranscript(), makeEnvelope(E['turn-start'], 4))
    expect(started).toMatchObject({ turnActive: true, turnStartedAt: makeEnvelope(E['turn-start'], 4).at })
    expect(reduceTranscript(started, makeEnvelope(E['turn-end'], 5))).toMatchObject({
      turnActive: false,
      turnStartedAt: null,
    })
  })

  it('reduceEvents replays history with seq 1..n', () => {
    expect(reduceEvents([E.message, text('x', 'snapshot')]).lastSeq).toBe(2)
  })
})

const part = (partId: string, t: string, mode: 'delta' | 'snapshot', parentId?: string): ChatEvent => ({
  kind: 'text-delta',
  messageId: 'a1',
  partId,
  text: t,
  mode,
  ...(parentId ? { parentId } : {}),
})
const nested = (parentId: string, partId: string): ChatEvent => part(partId, 'sub', 'snapshot', parentId)
const task = (patch: Partial<Extract<ChatEvent, { kind: 'task' }>> = {}): ChatEvent =>
  ({ ...E.task, ...patch }) as ChatEvent

describe('reduceTranscript: subagent tree', () => {
  it('indexes items by parentId in arrival order; childItems merges a task id and its tool call id', () => {
    const t = makeTranscript([
      tool('running', { title: 'Task' }),
      task(),
      nested('tc1', 'p1'),
      nested('task1', 'p2'),
      nested('tc1', 'p3'),
      text('top'),
    ])
    expect(t.children.tc1).toHaveLength(2)
    expect(childItems(t, ['task1', 'tc1']).map((i) => i.id)).toEqual(['p1', 'p2', 'p3'])
    expect(childItems(t, ['nope', undefined])).toEqual([])
  })

  it('an update keeps parentId and the item stays indexed once', () => {
    const t = makeTranscript([nested('tc1', 'p1'), part('p1', 'more', 'delta')])
    expect(only(t)).toMatchObject({ parentId: 'tc1', text: 'submore' })
    expect(t.children.tc1).toEqual([itemKey('text-delta', 'p1')])
  })

  it('task events upsert by taskId and keep omitted optional fields', () => {
    const t = makeTranscript([
      task(),
      task({ status: 'completed', summary: 'Found it', lastTool: undefined, usage: { tokens: 3000 } }),
    ])
    expect(only(t)).toMatchObject({
      kind: 'task',
      id: 'task1',
      toolCallId: 'tc1',
      taskKind: 'subagent',
      status: 'completed',
      summary: 'Found it',
      lastTool: 'Grep',
      usage: { tokens: 3000 },
    })
    expect(taskOfToolCall(t, 'tc1')?.id).toBe('task1')
    expect(taskOfToolCall(t, 'other')).toBeUndefined()
  })

  it('a task keeps when it started (first event) and when it finished (first final status)', () => {
    const t = makeTranscript([
      task(),
      task({ lastTool: 'Read' }),
      task({ status: 'completed' }),
      task({ status: 'completed', summary: 'late summary' }),
    ])
    expect(only(t)).toMatchObject({ startedAt: TEST_AT + 1, endedAt: TEST_AT + 3, summary: 'late summary' })
    const resumed = makeTranscript([task({ status: 'paused' }), task({ status: 'running' })])
    expect(only(resumed)).not.toHaveProperty('endedAt')
  })

  it('a nested task is a child of its parent task', () => {
    const t = makeTranscript([task(), task({ taskId: 'task2', toolCallId: 'tc2', parentId: 'tc1', depth: 2 })])
    expect(childItems(t, ['task1', 'tc1']).map((i) => i.id)).toEqual(['task2'])
  })
})

describe('reduceTranscript: questions, plans and session state', () => {
  it.each([
    ['question', E.question, 'q1'],
    ['plan-proposal', E['plan-proposal'], 'p1'],
  ] as const)(
    '%s opens an interaction; a re-sent event does not count twice; response-resolved closes it',
    (kind, event, id) => {
      const open = makeTranscript([event, event])
      expect(open.pendingInteractions).toBe(1)
      expect(only(open)).toMatchObject({ kind, id })
      const done = makeTranscript([
        event,
        { kind: 'response-resolved', eventId: id, outcome: 'answered', summary: 'Postgres' },
      ])
      expect(only(done)).toMatchObject({ resolved: 'answered', summary: 'Postgres' })
      expect(done.pendingInteractions).toBe(0)
    },
  )

  it('mcp-status replaces the server list', () => {
    const t = makeTranscript([E['mcp-status'], { kind: 'mcp-status', servers: [] }])
    expect(makeTranscript([E['mcp-status']]).mcpServers.map((s) => s.name)).toEqual(['github', 'db'])
    expect(t.mcpServers).toEqual([])
  })

  it('rate-limit is kept until cleared', () => {
    expect(makeTranscript([E['rate-limit']]).rateLimit).toMatchObject({ status: 'warning', utilization: 0.9 })
    expect(makeTranscript([E['rate-limit'], { kind: 'rate-limit', status: 'cleared' }]).rateLimit).toBeNull()
  })

  it.each([
    ['text', text('a')],
    ['a tool call', tool('running')],
    ['turn end', E['turn-end']],
    ['session exit', E['session-exit']],
  ])('retry is cleared by %s', (_name, event) => {
    expect(makeTranscript([E.retry]).retry).toMatchObject({ attempt: 2, maxAttempts: 5 })
    expect(makeTranscript([E.retry, event]).retry).toBeNull()
  })

  it('session-info sets the live actions; session exit clears them', () => {
    const live = makeTranscript([{ kind: 'session-info', actions: ['stopTask', 'toggleMcp'] }])
    expect(live.info.actions).toEqual(['stopTask', 'toggleMcp'])
    expect(makeTranscript([{ kind: 'session-info', actions: ['stopTask'] }, E['session-info']]).info.actions).toEqual([
      'stopTask',
    ])
    expect(makeTranscript([{ kind: 'session-info', actions: ['stopTask'] }, E['session-exit']]).info.actions).toEqual(
      [],
    )
  })
})

describe('reduceTranscript: transcript-truncate (rewind)', () => {
  const msg = (messageId: string): ChatEvent => ({ ...E.message, messageId }) as ChatEvent
  const rewound = (): ChatEvent[] => [
    msg('m1'),
    part('p1', 'first answer', 'snapshot'),
    msg('m2'),
    tool('running', { title: 'Task' }),
    nested('tc1', 'p2'),
    E['permission-request'],
    awaiting,
  ]

  it('drops the message and everything after it, reindexing what is left', () => {
    const t = makeTranscript([...rewound(), { kind: 'transcript-truncate', fromMessageId: 'm2' }, text('next')])
    expect(t.items.map((i) => i.id)).toEqual(['m1', 'p1', 'a1:0'])
    expect(t.positions).toEqual({
      [itemKey('message', 'm1')]: 0,
      [itemKey('text-delta', 'p1')]: 1,
      [itemKey('text-delta', 'a1:0')]: 2,
    })
    expect(t.children).toEqual({})
    expect(t.pendingInteractions).toBe(0)
  })

  it('an unknown message leaves the transcript as it was', () => {
    const before = makeTranscript(rewound())
    const after = makeTranscript([...rewound(), { kind: 'transcript-truncate', fromMessageId: 'nope' }])
    expect(after.items).toEqual(before.items)
    expect(after.pendingInteractions).toBe(2)
  })
})
