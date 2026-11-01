import { describe, expect, it } from 'vitest'
import { attachActivity } from '../src/main/activity'
import { SessionTracker } from '../src/main/tracker'
import { fakeClock } from './support/fake-clock'
import { TIMINGS } from './support/fakes'

describe('attachActivity', () => {
  it('data drives noteOutput; the disposer stops it', () => {
    const listeners = new Map<string, (d: string) => void>()
    const pty = {
      onData: (id: string, cb: (d: string) => void) => {
        listeners.set(id, cb)
        return () => listeners.delete(id)
      },
    }
    const tracker = new SessionTracker({
      sessionId: 's1',
      worktreeId: 'w1',
      source: 'activity',
      timings: TIMINGS,
      clock: fakeClock(),
      onChange: () => undefined,
    })
    const dispose = attachActivity({ pty, ptyId: 'p1', tracker })
    listeners.get('p1')?.('hello')
    expect(tracker.state.status).toBe('working')
    dispose()
    expect(listeners.has('p1')).toBe(false)
  })
})
