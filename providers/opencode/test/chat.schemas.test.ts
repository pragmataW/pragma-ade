import { describe, expect, it } from 'vitest'
import { REASON } from '../src/main/chat/constants'
import { messageSchema, parseV2Event } from '../src/main/chat/schemas'
import { CUSTOM, formPayloadSchema, formResponseSchema, retryPayloadSchema } from '../src/renderer/chat/payloads'
import { lookupLocale, scenarioEvents } from '../testing/fake-opencode-server/harness'

const samples = [...scenarioEvents('basic'), ...scenarioEvents('form-retry')].map((e) => [e.type, e] as const)

const sampleForm = {
  formId: 'frm_1',
  title: 'Pick a color',
  fields: [
    { key: 'color', type: 'string', options: [{ value: 'red', label: 'Red' }], custom: true },
    { key: 'confirm', type: 'boolean', required: true },
  ],
}

describe('opencode v2 schemas', () => {
  it.each(samples)('parses %s', (type, raw) => expect(parseV2Event(raw)?.type).toBe(type))

  it('server.connected parses', () => {
    expect(parseV2Event({ id: 'e', type: 'server.connected', data: {} })?.type).toBe('server.connected')
  })

  it('invalid consumed event → null, unknown → other, garbage → null', () => {
    expect(parseV2Event({ id: 'e', type: 'permission.asked', data: { nope: 1 } })).toBeNull()
    expect(parseV2Event({ id: 'e', type: 'future.thing', data: {} })?.type).toBe('other')
    expect(parseV2Event('nope')).toBeNull()
  })

  it('tool metadata drops invalid files and todos instead of failing', () => {
    const e = parseV2Event({
      id: 'e',
      type: 'session.tool.success',
      data: { sessionID: 's', id: 't', content: [{ type: 'text', text: 'x' }], metadata: { files: [{ bad: 1 }] } },
    })
    expect(e?.type === 'session.tool.success' && e.data.metadata?.files).toEqual([])
  })

  it.each([
    [{ id: 'm1', type: 'user', text: 'hi', files: [] }, 'user'],
    [{ id: 'm2', type: 'assistant', content: [{ type: 'text', text: 'x' }, { type: 'mystery' }] }, 'assistant'],
    [{ id: 'm3', type: 'idle', outcome: 'succeeded' }, 'idle'],
  ])('message %j', (raw, type) => expect(messageSchema.parse(raw).type).toBe(type))

  it('custom payload schemas round-trip', () => {
    expect(formPayloadSchema.parse(sampleForm)).toEqual(sampleForm)
    expect(retryPayloadSchema.parse({ attempt: 1, at: 2, message: 'm' })).toEqual({ attempt: 1, at: 2, message: 'm' })
    expect(formResponseSchema.parse({ cancel: true })).toEqual({ cancel: true })
    expect(Object.values(CUSTOM).every((t) => t.startsWith('opencode.'))).toBe(true)
  })

  it('every opencode reason key has English copy', () => {
    const own = Object.values(REASON).filter((k) => k.startsWith('opencode:'))
    expect(own.length).toBeGreaterThan(0)
    for (const k of own) expect(lookupLocale(k), k).toEqual(expect.any(String))
  })
})
