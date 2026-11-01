import { describe, expect, it } from 'vitest'
import { CHAT_EVENT_KINDS, chatEventEnvelopeSchema, chatEventSchema } from '../../src/contract'
import { makeEnvelope } from '../../testing'
import { EVENT_SAMPLES } from './samples'

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

  it('an envelope survives a JSON round-trip unchanged', () => {
    const env = makeEnvelope(EVENT_SAMPLES['permission-request'], 3)
    expect(chatEventEnvelopeSchema.parse(JSON.parse(JSON.stringify(env)))).toEqual(env)
  })
})
