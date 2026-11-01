import { describe, expect, it } from 'vitest'
import type { ChatEvent } from '../../src/contract'
import { useChatStore } from '../../src/renderer/session/store'
import { makeEnvelope, makeTranscript } from '../../testing'
import './support'

const delta = (text: string): ChatEvent => ({ kind: 'text-delta', messageId: 'a', partId: 'a:0', text, mode: 'delta' })

describe('useChatStore', () => {
  it('store.apply drops envelopes at or below lastSeq', () => {
    const s = useChatStore.getState()
    s.hydrate('s1', { providerId: 'fake', transcript: makeTranscript([delta('a'), delta('b')]), status: 'working' })
    s.apply(makeEnvelope(delta('b'), 2))
    s.apply(makeEnvelope(delta('c'), 3))
    s.apply(makeEnvelope(delta('x'), 1))
    expect(useChatStore.getState().sessions.s1?.transcript.items[0]).toMatchObject({ text: 'abc' })
  })

  it('apply derives status; unknown sessions are ignored', () => {
    const s = useChatStore.getState()
    s.apply(makeEnvelope(delta('a'), 1, 'other'))
    s.hydrate('s1', { providerId: 'fake', transcript: makeTranscript([]), status: 'idle' })
    s.apply(makeEnvelope({ kind: 'turn-start', turnId: 't' }, 1))
    expect(useChatStore.getState().sessions.s1?.status).toBe('working')
    expect(useChatStore.getState().sessions.other).toBeUndefined()
  })

  it('composer appends are consumed once', () => {
    const s = useChatStore.getState()
    s.pushComposerAppend('s1', 'one')
    s.pushComposerAppend('s1', 'two')
    expect(s.consumeComposerAppend('s1')).toEqual(['one', 'two'])
    expect(useChatStore.getState().consumeComposerAppend('s1')).toEqual([])
  })
})
