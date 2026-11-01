import { describe, expect, it } from 'vitest'
import {
  type ChatEvent,
  type ChatTranscript,
  emptyTranscript,
  reduceEvents,
  reduceTranscript,
  type ToolCallItem,
} from '../../src/contract'
import { makeEnvelope, makeEnvelopes, makeTranscript } from '../../testing'
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
