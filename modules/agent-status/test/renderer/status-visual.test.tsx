import type { AgentSessionStatus } from '@pragma/module-agents/contract'
import { describe, expect, it } from 'vitest'
import { countActive } from '../../src/lib/status-rules'
import { statusVisual } from '../../src/renderer/status-visual'
import { sessionInfo } from '../support/builders'

describe('statusVisual', () => {
  it.each<[AgentSessionStatus, boolean, string, string, boolean]>([
    ['working', false, 'working', 'var(--info)', true],
    ['waiting', false, 'waiting', 'var(--warn)', false],
    ['idle', true, 'done', 'var(--ok)', false],
    ['idle', false, 'idle', 'var(--mu)', false],
    ['error', false, 'error', 'var(--err)', false],
    ['starting', false, 'starting', 'var(--mu)', false],
    ['exited', false, 'exited', 'var(--fa)', false],
  ])('%s (turnCompleted %s) → %s', (status, done, kind, colorVar, spin) => {
    expect(statusVisual(status, done)).toEqual({ kind, colorVar, spin, labelKey: `agent-status:status.${kind}` })
  })
})

describe('countActive', () => {
  it.each<[AgentSessionStatus[], { working: number; waiting: number }]>([
    [[], { working: 0, waiting: 0 }],
    [['working', 'working', 'waiting', 'idle'], { working: 2, waiting: 1 }],
    [['exited', 'error'], { working: 0, waiting: 0 }],
  ])('%j', (statuses, counts) => {
    expect(countActive(statuses.map((status) => sessionInfo({ status })))).toEqual(counts)
  })
})
