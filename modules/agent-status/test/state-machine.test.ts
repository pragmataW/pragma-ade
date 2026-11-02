import type { AgentSessionStatus } from '@pragma/module-agents/contract'
import { describe, expect, it } from 'vitest'
import { reduceStatus, type TrackedState, type TrackerInput } from '../src/main/state-machine'
import { event, trackedState } from './support/builders'

const hook = (kind: Parameters<typeof event>[0], extra?: Record<string, unknown>): TrackerInput => ({
  source: 'hook',
  event: event(kind, extra),
})
const st = (status: AgentSessionStatus, over: Partial<TrackedState> = {}) => trackedState({ status, ...over })

describe('reduceStatus', () => {
  it.each<[string, TrackedState, TrackerInput, Partial<TrackedState>]>([
    ['anything while exited', st('exited'), hook('promptSubmitted'), { status: 'exited' }],
    [
      'lifecycle exited',
      st('working', { detail: 'Bash' }),
      { source: 'lifecycle', kind: 'exited' },
      { status: 'exited', detail: undefined },
    ],
    ['lifecycle failed', st('working'), { source: 'lifecycle', kind: 'failed' }, { status: 'error' }],
    ['sessionStarted from starting', st('starting'), hook('sessionStarted'), { status: 'idle' }],
    ['sessionStarted while working', st('working'), hook('sessionStarted'), { status: 'working' }],
    [
      'promptSubmitted',
      st('idle', { turnCompleted: true }),
      hook('promptSubmitted'),
      { status: 'working', turnCompleted: false },
    ],
    ['toolFinished', st('waiting'), hook('toolFinished'), { status: 'working' }],
    ['userResponded', st('waiting'), hook('userResponded'), { status: 'working' }],
    ['toolStarted', st('idle'), hook('toolStarted', { toolName: 'Bash' }), { status: 'working', detail: 'Bash' }],
    ['waitingForUser', st('working'), hook('waitingForUser'), { status: 'waiting' }],
    [
      'turnCompleted',
      st('working', { detail: 'x' }),
      hook('turnCompleted'),
      { status: 'idle', turnCompleted: true, detail: undefined },
    ],
    [
      'turnInterrupted (user interrupt) clears the tool detail',
      st('working', { detail: 'Bash' }),
      hook('turnInterrupted'),
      { status: 'idle', turnCompleted: false, detail: undefined },
    ],
    ['turnInterrupted while waiting (prompt dismissed)', st('waiting'), hook('turnInterrupted'), { status: 'idle' }],
    ['turnFailed', st('working'), hook('turnFailed', { message: 'boom' }), { status: 'error', detail: 'boom' }],
    ['sessionEnded', st('idle'), hook('sessionEnded'), { status: 'idle' }],
    ['activity output from starting', st('starting'), { source: 'activity', kind: 'output' }, { status: 'working' }],
    ['activity output from idle', st('idle'), { source: 'activity', kind: 'output' }, { status: 'working' }],
    ['activity output while waiting', st('waiting'), { source: 'activity', kind: 'output' }, { status: 'waiting' }],
    ['activity silence from working', st('working'), { source: 'activity', kind: 'silence' }, { status: 'idle' }],
    ['activity silence from starting', st('starting'), { source: 'activity', kind: 'silence' }, { status: 'starting' }],
    [
      'externalSessionId is updated',
      st('idle'),
      hook('sessionEnded', { externalSessionId: 'ext' }),
      { externalSessionId: 'ext' },
    ],
  ])('%s', (_n, state, input, expected) => {
    expect(reduceStatus(state, input)).toMatchObject(expected)
  })

  it.each<[TrackedState, TrackerInput]>([
    [st('working'), hook('toolFinished')],
    [st('idle'), hook('sessionEnded')],
    [st('exited'), { source: 'lifecycle', kind: 'failed' }],
  ])('same reference when unchanged (%j)', (state, input) => {
    expect(reduceStatus(state, input)).toBe(state)
  })
})
