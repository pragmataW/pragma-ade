import type { AgentSessionStatus } from '@pragma/module-agents/contract'
import { describe, expect, it } from 'vitest'
import { shouldMarkUnread, shouldNotify, summarize } from '../src/lib/status-rules'
import { sessionInfo } from './support/builders'

const s = (status: AgentSessionStatus, turnCompleted = false, unread = false) =>
  sessionInfo({ status, turnCompleted, unread })

describe('summarize', () => {
  it.each([
    ['empty', [], { status: null, turnCompleted: false, unreadCount: 0, sessionCount: 0 }],
    ['waiting beats working and idle', [s('idle'), s('waiting'), s('working')], { status: 'waiting' }],
    ['error beats working', [s('working'), s('error')], { status: 'error' }],
    ['two idle-done → turnCompleted', [s('idle', true), s('idle', true)], { status: 'idle', turnCompleted: true }],
    ['one idle without turn → false', [s('idle', true), s('idle')], { status: 'idle', turnCompleted: false }],
    ['exited loses to idle', [s('exited'), s('idle', true)], { status: 'idle', turnCompleted: true }],
    [
      'counts unread',
      [s('idle', false, true), s('working', false, true), s('exited')],
      { unreadCount: 2, sessionCount: 3 },
    ],
  ])('%s', (_n, sessions, expected) => {
    expect(summarize(sessions)).toMatchObject(expected)
  })
})

describe('shouldMarkUnread', () => {
  it.each<[AgentSessionStatus, AgentSessionStatus, boolean, boolean]>([
    ['working', 'waiting', false, true],
    ['working', 'idle', false, true],
    ['waiting', 'idle', false, true],
    ['starting', 'idle', false, false],
    ['working', 'waiting', true, false],
    ['waiting', 'waiting', false, false],
    ['idle', 'working', false, false],
  ])('%s → %s (selected %s) → %s', (prev, next, selected, out) => {
    expect(shouldMarkUnread(prev, next, selected)).toBe(out)
  })
})

describe('shouldNotify', () => {
  it.each<[AgentSessionStatus, AgentSessionStatus, boolean, boolean, boolean]>([
    ['working', 'waiting', false, true, true],
    ['working', 'waiting', true, true, false],
    ['working', 'waiting', false, false, false],
    ['waiting', 'waiting', false, true, false],
    ['working', 'idle', false, true, false],
  ])('%s → %s focused=%s enabled=%s → %s', (prev, next, appFocused, enabled, out) => {
    expect(shouldNotify(prev, next, { appFocused, enabled })).toBe(out)
  })
})
