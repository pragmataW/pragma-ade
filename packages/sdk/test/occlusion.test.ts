import { describe, expect, it, test, vi } from 'vitest'
import type { Rect } from '../src/common/shell'
import { coverModeFor, rectsIntersect, withTimeout } from '../src/runtime/main/occlusion'

const VIEW: Rect = { x: 100, y: 0, width: 400, height: 300 }

describe('rectsIntersect', () => {
  it.each([
    ['overlapping', { x: 450, y: 250, width: 100, height: 100 }, true],
    ['inside', { x: 150, y: 50, width: 10, height: 10 }, true],
    ['below (agents tab bar menu)', { x: 150, y: 320, width: 160, height: 90 }, false],
    ['touching edge only', { x: 0, y: 0, width: 100, height: 300 }, false],
    ['empty rect', { x: 150, y: 50, width: 0, height: 0 }, false],
  ])('%s', (_label, rect, hit) => {
    expect(rectsIntersect(VIEW, rect)).toBe(hit)
  })
})

describe('coverModeFor', () => {
  const menuBelow = { mode: 'hide' as const, rect: { x: 150, y: 320, width: 160, height: 90 } }
  test('no overlay, or none over the view: not covered', () => {
    expect(coverModeFor([], VIEW)).toBeNull()
    expect(coverModeFor([menuBelow], VIEW)).toBeNull()
  })
  test('a whole-window cover (modal backdrop) covers every view', () => {
    expect(coverModeFor([menuBelow, { mode: 'hide', rect: null }], VIEW)).toBe('hide')
  })
  test('snapshot wins over hide when both hit', () => {
    const over = { x: 120, y: 10, width: 50, height: 50 }
    expect(
      coverModeFor(
        [
          { mode: 'hide', rect: over },
          { mode: 'snapshot', rect: over },
        ],
        VIEW,
      ),
    ).toBe('snapshot')
  })
})

describe('withTimeout', () => {
  test('resolves with the value when fast enough', async () => {
    await expect(withTimeout(Promise.resolve('v'), 50)).resolves.toBe('v')
  })
  test('resolves null when slow or failing', async () => {
    vi.useFakeTimers()
    const slow = withTimeout(new Promise<string>(() => undefined), 50)
    vi.advanceTimersByTime(50)
    await expect(slow).resolves.toBeNull()
    vi.useRealTimers()
    await expect(withTimeout(Promise.reject(new Error('x')), 50)).resolves.toBeNull()
  })
})
