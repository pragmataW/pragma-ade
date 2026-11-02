import { describe, expect, it, vi } from 'vitest'
import type { StatusSessionMonitor } from '../src/contract'
import { attachActivity } from '../src/main/activity'
import { SessionTracker } from '../src/main/tracker'
import { fakeClock } from './support/fake-clock'
import { TIMINGS } from './support/fakes'

type Listener = (d: string) => void

function fakePty() {
  const data = new Map<string, Listener>()
  const input = new Map<string, Listener>()
  const on = (map: Map<string, Listener>) => (id: string, cb: Listener) => {
    map.set(id, cb)
    return () => void map.delete(id)
  }
  return { data, input, pty: { onData: on(data), onInput: on(input) } }
}

const tracker = (source: 'activity' | 'hooks' = 'activity') =>
  new SessionTracker({
    sessionId: 's1',
    worktreeId: 'w1',
    source,
    timings: TIMINGS,
    clock: fakeClock(),
    onChange: () => undefined,
  })

const fakeMonitor = () => ({
  onHookEvent: vi.fn(),
  onOutput: vi.fn(),
  onInterruptKey: vi.fn(),
  dispose: vi.fn(),
})

describe('attachActivity', () => {
  it('data drives noteOutput; the disposer stops it', () => {
    const { data, input, pty } = fakePty()
    const t = tracker()
    const dispose = attachActivity({ pty, ptyId: 'p1', tracker: t })
    data.get('p1')?.('hello')
    expect(t.state.status).toBe('working')
    dispose()
    expect(data.has('p1')).toBe(false)
    expect(input.has('p1')).toBe(false)
  })

  it('passes output and exact Esc / Ctrl-C writes (incl. kitty forms) to the monitor, nothing else', () => {
    const { data, input, pty } = fakePty()
    const t = tracker('hooks')
    const monitor = fakeMonitor()
    t.attachMonitor(monitor satisfies StatusSessionMonitor)
    attachActivity({ pty, ptyId: 'p1', tracker: t })
    data.get('p1')?.('spinner')
    expect(monitor.onOutput).toHaveBeenCalledTimes(1)
    for (const key of ['\x1b', '\x03', '\x1b[27u', '\x1b[99;5u']) input.get('p1')?.(key)
    for (const other of ['\x1b[A', 'a', '\x1b\x1bx', '\r']) input.get('p1')?.(other)
    expect(monitor.onInterruptKey).toHaveBeenCalledTimes(4)
  })

  it('the tracker disposes its monitor on exit and on dispose; a monitor attached after exit is disposed at once', () => {
    const t = tracker('hooks')
    const first = fakeMonitor()
    t.attachMonitor(first)
    const second = fakeMonitor()
    t.attachMonitor(second)
    expect(first.dispose).toHaveBeenCalledTimes(1)
    t.markExited()
    expect(second.dispose).toHaveBeenCalledTimes(1)
    expect(t.monitor).toBeUndefined()
    const late = fakeMonitor()
    t.attachMonitor(late)
    expect(late.dispose).toHaveBeenCalledTimes(1)
    expect(t.monitor).toBeUndefined()
    const other = tracker('hooks')
    const kept = fakeMonitor()
    other.attachMonitor(kept)
    other.dispose()
    expect(kept.dispose).toHaveBeenCalledTimes(1)
  })
})
