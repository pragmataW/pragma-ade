import { describe, expect, it, vi } from 'vitest'
import { SessionTracker, type StatusSource } from '../src/main/tracker'
import { event } from './support/builders'
import { fakeClock } from './support/fake-clock'

const GRACE = 30_000
const IDLE = 5_000

function tracker(source: StatusSource = 'pending-hooks') {
  const clock = fakeClock()
  const onChange = vi.fn()
  const onGraceExpired = vi.fn()
  const t = new SessionTracker({
    sessionId: 's1',
    worktreeId: 'w1',
    source,
    timings: { hookGraceMs: GRACE, activityIdleMs: IDLE },
    clock,
    onChange,
    onGraceExpired,
  })
  return { t, clock, onChange, onGraceExpired }
}

describe('SessionTracker', () => {
  it('pending-hooks ignores output before grace', () => {
    const { t, clock } = tracker()
    t.noteOutput()
    clock.advance(GRACE - 1)
    expect(t.state.status).toBe('starting')
    expect(t.source).toBe('pending-hooks')
  })

  it('switches to activity after grace and calls onGraceExpired once', () => {
    const { t, clock, onGraceExpired } = tracker()
    clock.advance(GRACE)
    expect(t.source).toBe('activity')
    clock.advance(GRACE * 2)
    expect(onGraceExpired).toHaveBeenCalledTimes(1)
    t.noteOutput()
    expect(t.state.status).toBe('working')
  })

  it('first hook event → hooks source, grace cancelled', () => {
    const { t, clock, onGraceExpired } = tracker()
    t.applyEvent(event('sessionStarted'))
    expect(t.source).toBe('hooks')
    expect(t.state.status).toBe('idle')
    clock.advance(GRACE * 2)
    expect(onGraceExpired).not.toHaveBeenCalled()
    expect(clock.pending()).toBe(0)
  })

  it('activity source reacts to output immediately', () => {
    const { t } = tracker('activity')
    t.noteOutput()
    expect(t.state.status).toBe('working')
  })

  it('output restarts the idle timer', () => {
    const { t, clock } = tracker('activity')
    t.noteOutput()
    clock.advance(IDLE - 1000)
    t.noteOutput()
    clock.advance(IDLE - 1)
    expect(t.state.status).toBe('working')
    clock.advance(1)
    expect(t.state.status).toBe('idle')
  })

  it('markExited stops timers, later events ignored', () => {
    const { t, clock } = tracker('activity')
    t.noteOutput()
    t.markExited()
    expect(clock.pending()).toBe(0)
    t.applyEvent(event('promptSubmitted'))
    t.noteOutput()
    expect(t.state.status).toBe('exited')
  })

  it('onChange only on change', () => {
    const { t, onChange } = tracker('hooks')
    t.applyEvent(event('promptSubmitted'))
    t.applyEvent(event('toolFinished'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'working' }),
      expect.objectContaining({ status: 'starting' }),
    )
  })

  it('setTimings affects later timers', () => {
    const { t, clock } = tracker('activity')
    t.setTimings({ activityIdleMs: 100 })
    t.noteOutput()
    clock.advance(100)
    expect(t.state.status).toBe('idle')
  })

  it("setSource('external') cancels grace", () => {
    const { t, clock, onGraceExpired } = tracker()
    t.setSource('external')
    clock.advance(GRACE)
    expect(onGraceExpired).not.toHaveBeenCalled()
    t.applyEvent(event('promptSubmitted'))
    expect(t.source).toBe('external')
  })
})
