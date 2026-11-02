import { describe, expect, it } from 'vitest'
import {
  CHAT_EVENT_KINDS,
  type ChatSessionHandle,
  chatEventEnvelopeSchema,
  chatEventSchema,
  chatPlanResponseSchema,
  chatQuestionResponseSchema,
  chatSessionActionSchema,
  documentKindOf,
  supportedActions,
} from '../../src/contract'
import { makeEnvelope } from '../../testing'
import { EVENT_SAMPLES } from './samples'

const fakeHandle = (): ChatSessionHandle => ({
  externalSessionId: 'x',
  describeOptions: () => [],
  setOption: async () => undefined,
  send: async () => undefined,
  interrupt: async () => undefined,
  respondPermission: async () => undefined,
  close: async () => undefined,
})

describe('chatEventSchema', () => {
  it.each(CHAT_EVENT_KINDS)('parses a sample of %s', (kind) => {
    expect(chatEventSchema.parse(EVENT_SAMPLES[kind])).toEqual(EVENT_SAMPLES[kind])
  })

  it.each([
    ['tool-call with a terminal status', { ...EVENT_SAMPLES['tool-call'], status: 'done' }],
    ['custom without a provider prefix', { kind: 'custom', type: 'nodot', data: 1 }],
  ])('rejects %s', (_name, event) => {
    expect(chatEventSchema.safeParse(event).success).toBe(false)
  })

  it.each([
    ['question without questions', { ...EVENT_SAMPLES.question, questions: [] }],
    ['task with an unknown status', { ...EVENT_SAMPLES.task, status: 'done' }],
    ['rate-limit utilization over 1', { ...EVENT_SAMPLES['rate-limit'], utilization: 2 }],
    ['retry attempt 0', { ...EVENT_SAMPLES.retry, attempt: 0 }],
    ['mcp server with an unknown status', { kind: 'mcp-status', servers: [{ name: 'x', status: 'up' }] }],
  ])('rejects %s', (_name, event) => {
    expect(chatEventSchema.safeParse(event).success).toBe(false)
  })

  it('parentId is accepted on transcript events and kept', () => {
    const nested = { ...EVENT_SAMPLES['tool-call'], parentId: 'tc0' }
    expect(chatEventSchema.parse(nested)).toEqual(nested)
  })

  it('an envelope survives a JSON round-trip unchanged', () => {
    const env = makeEnvelope(EVENT_SAMPLES['permission-request'], 3)
    expect(chatEventEnvelopeSchema.parse(JSON.parse(JSON.stringify(env)))).toEqual(env)
  })
})

describe('response and action schemas', () => {
  it.each([
    [chatQuestionResponseSchema, { answers: [{ question: 'Which?', selected: ['A'], other: 'C' }] }, true],
    [chatQuestionResponseSchema, { answers: [{ question: 'Which?' }] }, false],
    [chatPlanResponseSchema, { approve: true, mode: 'acceptEdits' }, true],
    [chatPlanResponseSchema, { approve: false, feedback: 'smaller steps' }, true],
    [chatPlanResponseSchema, { mode: 'plan' }, false],
    [chatSessionActionSchema, { action: 'toggleMcp', name: 'db', enabled: false }, true],
    [chatSessionActionSchema, { action: 'stopTask', taskId: 't' }, true],
    [chatSessionActionSchema, { action: 'fork' }, true],
    [chatSessionActionSchema, { action: 'stopTask' }, false],
    [chatSessionActionSchema, { action: 'explode' }, false],
  ])('%#: parses %o → %s', (schema, value, ok) => {
    expect(schema.safeParse(value).success).toBe(ok)
  })

  it('supportedActions lists the implemented handle methods', () => {
    const handle = { ...fakeHandle(), stopTask: async () => undefined, listMcp: async () => [] }
    expect(supportedActions(handle)).toEqual(['refreshMcp', 'stopTask'])
    expect(supportedActions(fakeHandle())).toEqual([])
  })

  it('documentKindOf maps PDF and text media types', () => {
    expect(documentKindOf('application/pdf')).toBe('pdf')
    expect(documentKindOf('text/markdown')).toBe('text')
  })
})
