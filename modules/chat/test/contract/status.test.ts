import { describe, expect, it } from 'vitest'
import { type ChatEvent, type ChatSessionStatus, nextStatus } from '../../src/contract'
import { EVENT_SAMPLES as E } from './samples'

const ANY: ChatSessionStatus[] = ['starting', 'working', 'waiting', 'idle', 'exited', 'error']
const exit = (reason: 'closed' | 'crashed' | 'startup_failed'): ChatEvent => ({
  kind: 'session-exit',
  exitCode: 1,
  reason,
})

const rows: [ChatSessionStatus, ChatEvent, number, ChatSessionStatus][] = [
  ['starting', E['session-info'], 0, 'idle'],
  ['idle', E['turn-start'], 0, 'working'],
  ['working', E['permission-request'], 1, 'waiting'],
  ['waiting', E['permission-resolved'], 0, 'working'],
  ['waiting', E['permission-resolved'], 1, 'waiting'],
  ['working', E['turn-end'], 0, 'idle'],
  ['idle', E.usage, 0, 'idle'],
  ['idle', E.custom, 0, 'idle'],
  ['working', { ...E.custom, eventId: 'e1', awaitsResponse: true } as ChatEvent, 1, 'waiting'],
  ['waiting', E['response-resolved'], 0, 'working'],
  ['working', E.question, 1, 'waiting'],
  ['working', E['plan-proposal'], 1, 'waiting'],
  ['working', E.task, 0, 'working'],
  ['working', E['mcp-status'], 0, 'working'],
  ['idle', E['rate-limit'], 0, 'idle'],
  ['working', E.retry, 0, 'working'],
  ...ANY.flatMap((s): [ChatSessionStatus, ChatEvent, number, ChatSessionStatus][] => [
    [s, exit('startup_failed'), 0, 'error'],
    [s, exit('crashed'), 0, 'exited'],
    [s, exit('closed'), 0, 'exited'],
    [s, { ...E.error, fatal: true } as ChatEvent, 0, 'error'],
  ]),
]

describe('nextStatus', () => {
  it.each(rows)('%s + %o (%d left) → %s', (prev, event, pendingInteractions, next) => {
    expect(nextStatus(prev, event, { pendingInteractions })).toBe(next)
  })
})
