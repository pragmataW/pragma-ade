import { describe, expect, it } from 'vitest'
import { createStatusReporter } from '../../src/main/status-reporter'
import { stubAgentsApi } from '../../testing'
import { EVENT_SAMPLES as E } from '../contract/samples'

describe('createStatusReporter', () => {
  it('reporter forwards only non-null mappings', () => {
    const agents = stubAgentsApi()
    const reporter = createStatusReporter(agents)
    for (const e of [E.usage, E['turn-start'], E['text-delta'], E['turn-end']]) reporter.onEvent('s1', e, 'ext')
    expect(agents.reports.map((r) => r.event)).toEqual([
      { kind: 'promptSubmitted', externalSessionId: 'ext' },
      { kind: 'turnCompleted', externalSessionId: 'ext' },
    ])
  })

  it('turnFailed carries the last error message of the session', () => {
    const agents = stubAgentsApi()
    const reporter = createStatusReporter(agents)
    reporter.onEvent('s1', E.error)
    reporter.onEvent('s1', { kind: 'turn-end', reason: 'error' })
    expect(agents.reports.at(-1)?.event).toEqual({ kind: 'turnFailed', message: 'boom' })
  })
})
