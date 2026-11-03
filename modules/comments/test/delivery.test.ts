import { agentSessionStatuses } from '@pragma/module-agents/contract'
import { afterEach, beforeEach, describe, expect, it, test, vi } from 'vitest'
import type { DeliveryRequest } from '../src/contract'
import { DeliveryRegistry } from '../src/main/delivery-registry'
import { formatNudge } from '../src/main/format'
import { createTerminalDelivery } from '../src/main/terminal-delivery'
import { isRunning } from '../src/main/upstream'
import { makeSession } from './factories'
import { createFakeUpstream } from './fakes'

const TEXT = 'Review comments:\n1. `a.ts:1`\n   fix'
const request = (o: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  sessionId: 's1',
  worktreeId: 'wt',
  mode: 'terminal',
  ptyId: 'pty1',
  round: 1,
  text: TEXT,
  comments: [],
  submit: false,
  ...o,
})
const fast = { submitDelayMs: 1, bracketedWaitMs: 1000, bracketedPollMs: 100 }

describe('DeliveryRegistry', () => {
  test('registry get/unregister', () => {
    const r = new DeliveryRegistry()
    const fn = async () => undefined
    const off = r.register('terminal', fn)
    expect(r.get('terminal')).toBe(fn)
    off()
    expect(r.get('terminal')).toBeUndefined()
  })
  test('duplicate mode throws', () => {
    const r = new DeliveryRegistry()
    r.register('chat', async () => undefined)
    expect(() => r.register('chat', async () => undefined)).toThrow()
  })
})

describe('terminal delivery', () => {
  it.each([
    [false, []],
    [true, [['pty1', '\r']]],
  ])('submit=%s', async (submit, expectedWritten) => {
    const up = createFakeUpstream()
    await createTerminalDelivery(up, fast)(request({ submit }))
    expect(up.pasted).toEqual([['pty1', TEXT]])
    expect(up.written).toEqual(expectedWritten)
    expect(up.order[0]).toBe('paste')
  })

  test('null ptyId throws sessionNotRunning', async () => {
    const up = createFakeUpstream()
    await expect(createTerminalDelivery(up, fast)(request({ ptyId: null }))).rejects.toMatchObject({
      key: 'sessionNotRunning',
    })
  })

  test('the one-line review nudge pastes without waiting for bracketed paste', async () => {
    const up = createFakeUpstream()
    up.bracketedOff.add('pty1')
    const text = formatNudge({ round: 1, open: 1, created: 1, updated: 0 })
    await createTerminalDelivery(up, fast)(request({ text }))
    expect(up.pasted).toEqual([['pty1', text]])
  })

  describe('with fake timers', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    test('multi-line text waits for bracketed paste mode', async () => {
      const up = createFakeUpstream()
      up.bracketedOff.add('pty1')
      const done = createTerminalDelivery(up, fast)(request())
      await vi.advanceTimersByTimeAsync(200)
      expect(up.pasted).toEqual([])
      up.bracketedOff.delete('pty1')
      await vi.advanceTimersByTimeAsync(200)
      await done
      expect(up.pasted).toEqual([['pty1', TEXT]])
    })

    test('bracketed mode never enabled → agentNotReady, nothing pasted or written', async () => {
      const up = createFakeUpstream()
      up.bracketedOff.add('pty1')
      const done = createTerminalDelivery(up, fast)(request({ submit: true }))
      const assertion = expect(done).rejects.toMatchObject({ key: 'agentNotReady' })
      await vi.advanceTimersByTimeAsync(1500)
      await assertion
      expect([up.pasted, up.written]).toEqual([[], []])
    })
  })
})

describe('isRunning', () => {
  it.each(agentSessionStatuses.map((s) => [s, !['exited', 'error'].includes(s)] as const))('%s → %s', (status, want) =>
    expect(isRunning(makeSession({ status }))).toBe(want),
  )
  test('closedAt set → not running', () => expect(isRunning(makeSession({ closedAt: 5 }))).toBe(false))
})
