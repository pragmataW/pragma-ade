import type { AgentStatusEvent } from '@pragma/module-agent-status/contract'
import { describe, expect, it } from 'vitest'
import { CHAT_EVENT_KINDS, type ChatEvent, toAgentStatusEvent } from '../../src/contract'
import { EVENT_SAMPLES as E } from './samples'

const end = (reason: 'completed' | 'interrupted' | 'error' | 'limit'): ChatEvent => ({ kind: 'turn-end', reason })
const rows: [string, ChatEvent, AgentStatusEvent | null][] = [
  ['session-info with id', E['session-info'], { kind: 'sessionStarted' }],
  ['session-info without id', { kind: 'session-info', commands: [] }, null],
  ['turn-start', E['turn-start'], { kind: 'promptSubmitted' }],
  [
    'running tool-call',
    { ...E['tool-call'], status: 'running' } as ChatEvent,
    { kind: 'toolStarted', toolName: 'Run' },
  ],
  ['pending tool-call', E['tool-call'], null],
  ['tool-result', E['tool-result'], { kind: 'toolFinished' }],
  ['permission-request', E['permission-request'], { kind: 'waitingForUser', reason: 'permission' }],
  [
    'awaiting custom',
    { ...E.custom, awaitsResponse: true } as ChatEvent,
    { kind: 'waitingForUser', reason: 'question' },
  ],
  ['plain custom', E.custom, null],
  ['permission-resolved', E['permission-resolved'], { kind: 'userResponded' }],
  ['response-resolved', E['response-resolved'], { kind: 'userResponded' }],
  ['turn-end completed', end('completed'), { kind: 'turnCompleted' }],
  ['turn-end limit', end('limit'), { kind: 'turnCompleted' }],
  ['turn-end interrupted', end('interrupted'), { kind: 'turnInterrupted' }],
  ['turn-end error', end('error'), { kind: 'turnFailed', message: 'boom' }],
  ['session-exit', E['session-exit'], { kind: 'sessionEnded' }],
  ['usage', E.usage, null],
  ['text-delta', E['text-delta'], null],
]

describe('toAgentStatusEvent', () => {
  it.each(rows)('%s', (_name, event, expected) => {
    expect(toAgentStatusEvent(event, undefined, 'boom')).toEqual(expected)
  })

  it.each(CHAT_EVENT_KINDS)('handles %s', (kind) => {
    expect(() => toAgentStatusEvent(E[kind])).not.toThrow()
  })

  it('adds externalSessionId and cuts long error text to the agent-status field limit', () => {
    const mapped = toAgentStatusEvent(end('error'), 'ext', 'x'.repeat(1000))
    expect(mapped).toMatchObject({ kind: 'turnFailed', externalSessionId: 'ext' })
    expect((mapped as { message: string }).message.length).toBeLessThanOrEqual(200)
  })
})
