import { afterEach, expect, it, vi } from 'vitest'
import { placePopover } from '../src/lib/place-popover'

const VIEWPORT = { width: 1000, height: 800 }
function floating(width: number, height: number): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON() {},
  })
  Object.defineProperty(el, 'offsetWidth', { value: width })
  Object.defineProperty(el, 'offsetHeight', { value: height })
  document.body.appendChild(el)
  return el
}
afterEach(() => vi.unstubAllGlobals())

it.each([
  [
    'bottom placement below rect with offset',
    { x: 100, y: 100, width: 50, height: 20 },
    { x: 100, y: 126, placement: 'bottom-start' },
  ],
  [
    'flips to top near the viewport bottom',
    { x: 100, y: 760, width: 50, height: 20 },
    { y: 760 - 6 - 100, placement: 'top-start' },
  ],
])('%s', async (_name, rect, expected) => {
  vi.stubGlobal('innerWidth', VIEWPORT.width)
  vi.stubGlobal('innerHeight', VIEWPORT.height)
  Object.defineProperty(document.documentElement, 'clientWidth', { value: VIEWPORT.width, configurable: true })
  Object.defineProperty(document.documentElement, 'clientHeight', { value: VIEWPORT.height, configurable: true })
  expect(await placePopover(rect, floating(200, 100))).toMatchObject(expected)
})
it('shifts inside viewport padding', async () => {
  Object.defineProperty(document.documentElement, 'clientWidth', { value: VIEWPORT.width, configurable: true })
  Object.defineProperty(document.documentElement, 'clientHeight', { value: VIEWPORT.height, configurable: true })
  const { x } = await placePopover({ x: 980, y: 100, width: 10, height: 20 }, floating(200, 100))
  expect(x).toBeLessThanOrEqual(VIEWPORT.width - 8 - 200)
  expect(x).toBeLessThan(980)
})
