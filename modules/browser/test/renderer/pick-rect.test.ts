import { expect, it } from 'vitest'
import { pickRectInWindow } from '../../src/renderer/lib/pick-rect'

const RECT = { x: 100, y: 50, width: 40, height: 20 }
it.each([
  ['scale 1', { width: 800, height: 600 }, { x: 0, y: 0, width: 800, height: 600 }, RECT],
  [
    'scale 0.5',
    { width: 800, height: 600 },
    { x: 0, y: 0, width: 400, height: 300 },
    { x: 50, y: 25, width: 20, height: 10 },
  ],
  [
    'area offset',
    { width: 800, height: 600 },
    { x: 1000, y: 98, width: 800, height: 600 },
    { x: 1100, y: 148, width: 40, height: 20 },
  ],
  [
    'zero viewport',
    { width: 0, height: 0 },
    { x: 10, y: 10, width: 800, height: 600 },
    { x: 110, y: 60, width: 40, height: 20 },
  ],
])('%s', (_, viewport, area, expected) => expect(pickRectInWindow(RECT, viewport, area)).toEqual(expected))
