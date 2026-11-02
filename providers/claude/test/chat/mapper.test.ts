import { MAX_TOOL_OUTPUT_CHARS, TRUNCATION_MARKER } from '@pragma/module-chat/contract'
import { describe, expect, it } from 'vitest'
import { createSdkMessageMapper, type MapperFrame } from '../../src/main/chat/mapper'
import * as F from './frames'

describe('createSdkMessageMapper', () => {
  it('stream deltas use the content_block index for part ids', () => {
    const events = F.mapAll([F.messageStart('m1'), F.blockStart(0, { type: 'text', text: '' }), F.textDelta(0, 'He')])
    expect(events).toEqual([{ kind: 'text-delta', messageId: 'm1', partId: 'm1:0', text: 'He', mode: 'delta' }])
  })

  it('thinking deltas map to thinking', () => {
    const events = F.mapAll([F.messageStart('m1'), F.blockStart(0, { type: 'thinking' }), F.thinkingDelta(0, 'hm')])
    expect(events).toEqual([{ kind: 'thinking', messageId: 'm1', partId: 'm1:0', text: 'hm', mode: 'delta' }])
  })

  it('one block per assistant frame yields msg:0 thinking and msg:1 text snapshots', () => {
    const events = F.mapAll([F.assistant('msg', F.thinking('plan')), F.assistant('msg', F.text('done'))])
    expect(events).toEqual([
      { kind: 'thinking', messageId: 'msg', partId: 'msg:0', text: 'plan', mode: 'snapshot' },
      { kind: 'text-delta', messageId: 'msg', partId: 'msg:1', text: 'done', mode: 'snapshot' },
    ])
  })

  it('tool_use start emits a pending tool-call; the assistant frame emits running + file-edit', () => {
    const events = F.mapAll([
      F.messageStart('m'),
      F.blockStart(0, { type: 'tool_use', id: 'toolu_edit_1', name: 'Edit', input: {} }),
      F.assistant('m', F.editUse()),
    ])
    expect(events.map((e) => [e.kind, 'status' in e ? e.status : undefined])).toEqual([
      ['tool-call', 'pending'],
      ['tool-call', 'running'],
      ['file-edit', undefined],
    ])
    expect(events[1]).toMatchObject({ title: 'README.md', toolKind: 'edit' })
    expect(events[2]).toMatchObject({ toolCallId: 'toolu_edit_1', change: 'edit' })
  })

  it('TodoWrite emits a todo instead of a file-edit', () => {
    const input = { todos: [{ content: 'x', status: 'in_progress' }] }
    const events = F.mapAll([F.assistant('m', F.toolUse('t1', 'TodoWrite', input))])
    expect(events.map((e) => e.kind)).toEqual(['tool-call', 'todo'])
    expect(events[1]).toMatchObject({ toolCallId: 't1', items: [{ status: 'active' }] })
  })

  it('tool_result maps output, is_error and a Write originalFile', () => {
    const write = F.toolUse('w1', 'Write', { file_path: 'a.txt', content: 'new' })
    const events = F.mapAll([
      F.assistant('m', write),
      F.toolResult('w1', [{ type: 'text', text: 'ok' }], { tool_use_result: { originalFile: 'old' } }),
      F.toolResult('x', 'boom', {}, true),
    ])
    expect(events.slice(2)).toEqual([
      { kind: 'tool-result', toolCallId: 'w1', status: 'completed', output: 'ok' },
      {
        kind: 'file-edit',
        toolCallId: 'w1',
        path: 'a.txt',
        change: 'overwrite',
        hunks: [{ before: 'old', after: 'new' }],
      },
      { kind: 'tool-result', toolCallId: 'x', status: 'error', output: 'boom', error: 'boom' },
    ])
  })

  it('5 MB tool output truncated to ≤ 32 768 chars plus marker with outputTruncated', () => {
    const [event] = F.mapAll([F.toolResult('t', 'x'.repeat(5 * 1024 * 1024))])
    expect(event).toMatchObject({ kind: 'tool-result', outputTruncated: true })
    const output = (event as { output: string }).output
    expect(output.length).toBeLessThanOrEqual(MAX_TOOL_OUTPUT_CHARS + TRUNCATION_MARKER.length)
    expect(output.endsWith(TRUNCATION_MARKER)).toBe(true)
  })

  it('result emits usage then turn-end completed', () => {
    const events = F.mapAll([F.assistant('m', F.text('a')), F.result()])
    expect(events.slice(1)).toEqual([
      {
        kind: 'usage',
        inputTokens: 120,
        outputTokens: 40,
        cacheReadTokens: 30,
        cacheWriteTokens: 10,
        costUsd: 0.0123,
        contextWindow: 200_000,
        contextTokens: 200,
      },
      { kind: 'turn-end', reason: 'completed' },
    ])
  })

  it.each([
    ['error_max_turns', 'limit'],
    ['error_max_budget_usd', 'limit'],
  ])('%s → turn-end %s', (subtype, reason) => {
    expect(F.mapAll([F.result(subtype)]).at(-1)).toEqual({ kind: 'turn-end', reason })
  })

  it('error_during_execution after markInterruptRequested → interrupted; otherwise turn_failed', () => {
    const m = createSdkMessageMapper()
    m.markInterruptRequested()
    expect(m.map(F.result('error_during_execution') as MapperFrame).at(-1)).toEqual({
      kind: 'turn-end',
      reason: 'interrupted',
    })
    const failed = m.map(F.result('error_during_execution', { errors: ['a', 'b'] }) as MapperFrame)
    expect(failed.slice(1)).toEqual([
      { kind: 'error', code: 'turn_failed', message: 'a\nb', fatal: false },
      { kind: 'turn-end', reason: 'error' },
    ])
  })

  it('system/init becomes session-info with the session id', () => {
    expect(F.mapAll([F.init()])).toEqual([{ kind: 'session-info', externalSessionId: 'sess-1' }])
  })

  it('compact_boundary becomes custom claude.compact-boundary', () => {
    expect(F.mapAll([F.compactBoundary()])).toEqual([
      { kind: 'custom', type: 'claude.compact-boundary', data: { trigger: 'auto', preTokens: 48_000 } },
    ])
  })

  it.each([
    ['authentication_failed', 'auth'],
    ['rate_limit', 'rate_limit'],
  ])('assistant error %s → %s', (error, code) => {
    expect(F.mapAll([F.assistant('m', F.text(''), { error })]).at(-1)).toMatchObject({ kind: 'error', code })
  })

  it('unknown frame type maps to []', () => {
    expect(F.mapAll([{ type: 'message_kind_from_the_future' }, { type: 'system', subtype: 'status' }])).toEqual([])
  })

  it('history user text becomes message{origin:history}; tool-result-only frames produce no message', () => {
    const events = F.mapAll([F.userText('u1', 'hello'), F.toolResult('t', 'x')], { origin: 'history' })
    expect(events.map((e) => e.kind)).toEqual(['message', 'tool-result'])
    expect(events[0]).toMatchObject({ messageId: 'u1', text: 'hello', origin: 'history' })
    expect(F.mapAll([F.userText('u1', 'live')])).toEqual([])
  })

  it('finish completes tools that never got a result', () => {
    const m = createSdkMessageMapper({ origin: 'history' })
    m.map(F.assistant('m', F.toolUse('t9', 'Bash', { command: 'ls' })) as MapperFrame)
    expect(m.finish()).toEqual([{ kind: 'tool-result', toolCallId: 't9', status: 'completed' }])
  })
})
