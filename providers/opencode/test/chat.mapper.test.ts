import type { ChatEvent } from '@pragma/module-chat/contract'
import { describe, expect, it } from 'vitest'
import { TOOL_OUTPUT_MAX_CHARS } from '../src/main/chat/constants'
import { EventMapper, errorCodeOf } from '../src/main/chat/mapping/event-mapper'
import { parseV2Event } from '../src/main/chat/schemas'
import type { HubEvent } from '../src/main/chat/wire/event-hub'
import { CUSTOM, formPayloadSchema } from '../src/renderer/chat/payloads'
import { FAKE_AMID, FAKE_SID, kinds, ofKind, scenarioEvents } from '../testing/fake-opencode-server/harness'

const WINDOW = 10_000
const newMapper = (contextWindow: () => number | undefined = () => WINDOW) => new EventMapper({ contextWindow })
const ev = (type: string, data: Record<string, unknown>): HubEvent => {
  const e = parseV2Event({ id: 'e', type, data: { sessionID: FAKE_SID, ...data } })
  if (!e || e.type === 'other') throw new Error(`bad sample ${type}`)
  return e
}
const feed = (m: EventMapper, events: HubEvent[]): ChatEvent[] => events.flatMap((e) => m.map(e))
/** The scenario turn as hub events, with the permission round-trip the fake adds around `awaitPermission`. */
function basicTurn(): HubEvent[] {
  const raw = scenarioEvents('basic')
  const at = raw.findIndex((e) => e.type === 'session.tool.called' && (e.data as { id: string }).id === 'call_edit')
  const permission = [
    ev('permission.asked', {
      id: 'per_1',
      action: 'edit',
      resources: ['src/a.ts'],
      save: ['*'],
      source: { type: 'tool', messageID: FAKE_AMID, id: 'call_edit' },
    }),
    ev('permission.replied', { requestID: 'per_1', reply: 'once' }),
  ]
  const events = raw.map((r) => {
    const e = parseV2Event(r)
    if (!e || e.type === 'other') throw new Error(`bad ${r.type}`)
    return e
  })
  return [...events.slice(0, at + 1), ...permission, ...events.slice(at + 1)]
}
const err = (message = 'boom', extra: Record<string, unknown> = {}) => ({ type: 'ProviderError', message, ...extra })
const started = ev('session.execution.started', {})

describe('EventMapper', () => {
  it('a step error repeated by execution.failed is shown once; 429 raises then clears the rate-limit banner', () => {
    const m = new EventMapper({ contextWindow: () => WINDOW, now: () => 1000 })
    const limited = { type: 'ProviderError', message: 'slow down', status: 429, retryAfterMs: 5000 }
    const out = feed(m, [
      started,
      ev('session.step.failed', { error: limited }),
      ev('session.execution.failed', { error: limited }),
    ])
    expect(kinds(out)).toEqual(['error', 'rate-limit', 'turn-end'])
    expect(ofKind(out, 'rate-limit')[0]).toMatchObject({ status: 'rejected', resetsAt: 6000 })
    const next = feed(m, [started, ev('session.execution.succeeded', {})])
    expect(ofKind(next, 'rate-limit')).toEqual([{ kind: 'rate-limit', status: 'cleared' }])
  })

  it('maps the basic scenario turn', () => {
    const out = feed(newMapper(), basicTurn())
    expect(kinds(out)).toEqual([
      'thinking',
      'thinking',
      'text-delta',
      'text-delta',
      'text-delta',
      'tool-call',
      'tool-call',
      'tool-result',
      'tool-call',
      'tool-call',
      'permission-request',
      'permission-resolved',
      'tool-result',
      'file-edit',
      'tool-call',
      'tool-call',
      'tool-result',
      'todo',
      'usage',
      'turn-end',
    ])
    expect(ofKind(out, 'usage')[0]).toEqual({
      kind: 'usage',
      inputTokens: 1200,
      outputTokens: 300,
      cacheReadTokens: 500,
      cacheWriteTokens: 0,
      costUsd: 0.0123,
      contextTokens: 2000,
      contextWindow: 10000,
    })
    expect(ofKind(out, 'file-edit')[0]).toEqual({
      kind: 'file-edit',
      toolCallId: 'call_edit',
      path: 'src/a.ts',
      change: 'edit',
      hunks: [{ before: 'a', after: 'b' }],
    })
    expect(ofKind(out, 'permission-request')[0]).toMatchObject({
      requestId: 'per_1',
      toolCallId: 'call_edit',
      toolName: 'edit',
      toolKind: 'edit',
      title: 'src/a.ts',
      input: { path: 'src/a.ts', oldString: 'a', newString: 'b' },
      options: ['allow_once', 'allow_always', 'deny'],
    })
    expect(ofKind(out, 'permission-request')[0]).not.toHaveProperty('detail')
    expect(ofKind(out, 'permission-resolved')[0]).toEqual({
      kind: 'permission-resolved',
      requestId: 'per_1',
      outcome: 'allowed',
    })
    expect(ofKind(out, 'todo')[0]?.items.map((i) => i.status)).toEqual(['done', 'active'])
    expect(ofKind(out, 'tool-call')[1]).toMatchObject({
      toolCallId: 'call_read',
      title: 'README.md',
      status: 'running',
    })
    expect(ofKind(out, 'tool-result')[0]).toMatchObject({
      toolCallId: 'call_read',
      status: 'completed',
      output: '# fixture',
    })
    const text = ofKind(out, 'text-delta')
    expect(text.map((t) => t.mode)).toEqual(['delta', 'delta', 'snapshot'])
    expect(new Set(text.map((t) => t.partId))).toEqual(new Set([`${FAKE_AMID}:text:1`]))
    expect(ofKind(out, 'turn-end')[0]?.reason).toBe('completed')
  })

  it('tracks turn state and pending interactions', () => {
    const m = newMapper()
    m.map(started)
    m.map(ev('permission.asked', { id: 'p', action: 'bash', resources: ['ls'] }))
    m.map(ev('form.created', { form: { id: 'f', sessionID: FAKE_SID, title: 't', fields: [] } }))
    expect([m.turnActive, m.pendingPermissions, m.pendingForms]).toEqual([true, ['p'], ['f']])
    m.forget('p')
    expect(m.pendingPermissions).toEqual([])
    expect(m.map(ev('permission.replied', { requestID: 'p', reply: 'reject' }))).toEqual([])
  })

  it.each([
    [
      'step.failed then succeeded → turn-end error',
      [ev('session.step.failed', { error: err() }), ev('session.execution.succeeded', {})],
      ['error', 'turn-end'],
      'error',
    ],
    [
      'execution.failed → error + turn-end error',
      [ev('session.execution.failed', { error: err() })],
      ['error', 'turn-end'],
      'error',
    ],
    [
      'interrupted → turn-end interrupted',
      [ev('session.execution.interrupted', { reason: 'user' })],
      ['turn-end'],
      'interrupted',
    ],
  ])('%s', (_, events, expectedKinds, reason) => {
    const m = newMapper()
    const out = feed(m, [started, ...events])
    expect(kinds(out)).toEqual(expectedKinds)
    expect(ofKind(out, 'turn-end')[0]?.reason).toBe(reason)
    expect(m.turnActive).toBe(false)
  })

  it('markInterrupted turns a later failure into turn-end interrupted, pending cleared', () => {
    const m = newMapper()
    m.map(started)
    m.map(ev('permission.asked', { id: 'p', action: 'bash', resources: [] }))
    m.markInterrupted()
    expect(m.map(ev('session.execution.failed', { error: err() }))).toEqual([
      { kind: 'turn-end', reason: 'interrupted' },
    ])
    expect(m.pendingPermissions).toEqual([])
  })

  it('a scheduled retry becomes the kit retry event; forms become opencode custom events', () => {
    const out = feed(new EventMapper({ contextWindow: () => WINDOW, now: () => 0 }), [
      ...scenarioEvents('form-retry').flatMap((r) => {
        const e = parseV2Event(r)
        return e && e.type !== 'other' ? [e] : []
      }),
    ])
    expect(ofKind(out, 'retry')).toEqual([{ kind: 'retry', attempt: 1, delayMs: 0, reason: 'rate limited' }])
    const m = newMapper()
    const form = m.map(
      ev('form.created', {
        form: { id: 'frm_1', sessionID: FAKE_SID, title: 'Pick', fields: [{ key: 'c', type: 'boolean' }] },
      }),
    )[0]
    expect(form).toMatchObject({ kind: 'custom', type: CUSTOM.form, eventId: 'frm_1', awaitsResponse: true })
    expect(formPayloadSchema.parse((form as { data: unknown }).data).formId).toBe('frm_1')
    expect(m.map(ev('form.replied', { id: 'frm_1', answer: {} }))).toEqual([
      { kind: 'response-resolved', eventId: 'frm_1', outcome: 'answered' },
    ])
    m.map(ev('form.created', { form: { id: 'frm_2', sessionID: FAKE_SID, title: 'x', fields: [] } }))
    expect(m.map(ev('form.cancelled', { id: 'frm_2' }))).toEqual([
      { kind: 'response-resolved', eventId: 'frm_2', outcome: 'cancelled' },
    ])
  })

  it('tool output truncated past limit; failure carries the error and edits', () => {
    const m = newMapper()
    m.map(ev('session.tool.input.started', { id: 't', name: 'shell' }))
    const long = 'x'.repeat(TOOL_OUTPUT_MAX_CHARS + 5)
    const [ok] = m.map(ev('session.tool.success', { id: 't', content: [{ type: 'text', text: long }] }))
    expect(ok).toMatchObject({ output: long.slice(0, TOOL_OUTPUT_MAX_CHARS), outputTruncated: true })
    const failed = m.map(
      ev('session.tool.failed', {
        id: 't',
        error: err('nope'),
        metadata: { files: [{ file: 'b.ts', patch: '@@ -0,0 +1 @@\n+x\n', status: 'added' }] },
      }),
    )
    expect(failed).toEqual([
      { kind: 'tool-result', toolCallId: 't', status: 'error', error: 'nope' },
      { kind: 'file-edit', toolCallId: 't', path: 'b.ts', change: 'create', hunks: [{ before: '', after: 'x' }] },
    ])
  })

  it.each([
    [err('x', { status: 401 }), 'auth'],
    [err('x', { status: 403 }), 'auth'],
    [{ type: 'ProviderAuthError', message: 'x' }, 'auth'],
    [err('x', { status: 429 }), 'rate_limit'],
    [{ type: 'RateLimitError', message: 'x' }, 'rate_limit'],
    [err('x', { status: 500 }), 'turn_failed'],
  ])('errorCodeOf %j → %s', (e, code) => expect(errorCodeOf(e)).toBe(code))

  it('contextWindow unknown → omitted', () => {
    const m = newMapper(() => undefined)
    const tokens = { input: 1, output: 2, reasoning: 0, cache: { read: 0, write: 0 } }
    m.map(ev('session.step.started', { assistantMessageID: 'a', model: { id: 'm', providerID: 'p' } }))
    m.map(ev('session.step.ended', { assistantMessageID: 'a', tokens, cost: 0 }))
    const [usage] = m.map(ev('session.usage.updated', { tokens, cost: 0 }))
    expect(usage).not.toHaveProperty('contextWindow')
    expect(usage).toMatchObject({ contextTokens: 3 })
  })

  it('a tool called without a start event still maps', () => {
    expect(newMapper().map(ev('session.tool.called', { id: 'z', input: { path: 'a' } }))[0]).toMatchObject({
      toolCallId: 'z',
      name: '',
      toolKind: 'other',
      status: 'running',
    })
  })
})
