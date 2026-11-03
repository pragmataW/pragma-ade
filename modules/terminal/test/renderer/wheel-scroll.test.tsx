import type { Terminal } from '@xterm/xterm'
import { expect, test, vi } from 'vitest'
import { MAX_WHEEL_STEPS_PER_EVENT, WHEEL_DELTA_MODE } from '../../src/constants'
import { TerminalSettingsSchema } from '../../src/contract'
import { createWheelStepper, installWheelScroll, type WheelScale } from '../../src/renderer/view/wheel-scroll'

const CELL_PX = 16
const ROWS = 30
const scale = (over: Partial<WheelScale> = {}): WheelScale => ({
  cellHeightPx: CELL_PX,
  rows: ROWS,
  sensitivity: 1,
  fastSensitivity: 5,
  ...over,
})
const px = (deltaY: number, mods: Partial<WheelEventInit> = {}) =>
  new WheelEvent('wheel', { deltaY, deltaMode: WHEEL_DELTA_MODE.pixel, bubbles: true, cancelable: true, ...mods })

test('settings default to VS Code terminal sensitivities and reject out-of-range values', () => {
  const s = TerminalSettingsSchema.parse({})
  expect([s.scrollSensitivity, s.fastScrollSensitivity]).toEqual([1, 5])
  expect(TerminalSettingsSchema.safeParse({ scrollSensitivity: 0 }).success).toBe(false)
  expect(TerminalSettingsSchema.safeParse({ fastScrollSensitivity: 0.5 }).success).toBe(false)
})

test('trackpad pixel deltas accumulate into one step per line of travel, without dampening', () => {
  const stepper = createWheelStepper()
  const steps = [4, 4, 4, 4, 4, 4, 4, 4].map((d) => stepper.steps(px(d), scale()))
  expect(steps).toEqual([0, 0, 0, 1, 0, 0, 0, 1])
})

test('a mouse wheel notch moves several lines; line and page modes scale by lines and rows', () => {
  const stepper = createWheelStepper()
  expect(stepper.steps(px(-100), scale())).toBe(-6)
  stepper.reset()
  expect(stepper.steps(new WheelEvent('wheel', { deltaY: 3, deltaMode: WHEEL_DELTA_MODE.line }), scale())).toBe(3)
  expect(stepper.steps(new WheelEvent('wheel', { deltaY: 1, deltaMode: WHEEL_DELTA_MODE.page }), scale())).toBe(ROWS)
})

test('sensitivity, Alt/Ctrl fast scroll, direction change and the per-event cap', () => {
  const stepper = createWheelStepper()
  expect(stepper.steps(px(CELL_PX), scale({ sensitivity: 2 }))).toBe(2)
  expect(stepper.steps(px(CELL_PX, { altKey: true }), scale())).toBe(5)
  expect(stepper.steps(px(CELL_PX / 2), scale())).toBe(0)
  // the half line left over going down does not eat the first half line going up
  expect(stepper.steps(px(-CELL_PX), scale())).toBe(-1)
  expect(stepper.steps(px(CELL_PX * 1000), scale())).toBe(MAX_WHEEL_STEPS_PER_EVENT)
})

type WheelHandler = (e: WheelEvent) => boolean

function fakeTerminal(mouseTrackingMode: string, bufferType: string) {
  const element = document.createElement('div')
  const screen = document.createElement('div')
  screen.className = 'xterm-screen'
  Object.defineProperty(screen, 'clientHeight', { value: CELL_PX * ROWS })
  element.append(screen)
  document.body.append(element)
  let handler: WheelHandler = () => true
  const term = {
    element,
    rows: ROWS,
    modes: { mouseTrackingMode },
    buffer: { active: { type: bufferType } },
    attachCustomWheelEventHandler: (h: WheelHandler) => {
      handler = h
    },
  }
  const forwarded: WheelEvent[] = []
  // stands in for xterm's own wheel listener: it asks the custom handler, then reports the event
  element.addEventListener('wheel', (e) => {
    if (handler(e)) forwarded.push(e)
  })
  return { term: term as unknown as Terminal, screen, forwarded, call: (e: WheelEvent) => handler(e) }
}

const settings = () => ({ scrollSensitivity: 1, fastScrollSensitivity: 5, fontSize: CELL_PX })

test('normal buffer without mouse reporting keeps xterm’s own (native-like) viewport scrolling', () => {
  const fake = fakeTerminal('none', 'normal')
  installWheelScroll(fake.term, settings)
  expect(fake.call(px(CELL_PX * 3))).toBe(true)
})

test.each([
  ['vt200', 'normal'],
  ['any', 'alternate'],
  ['none', 'alternate'],
])('mouse mode %s on the %s buffer sends one line-mode wheel event per line of travel', (mode, buffer) => {
  const fake = fakeTerminal(mode, buffer)
  installWheelScroll(fake.term, settings)
  const real = px(-CELL_PX * 3, { clientX: 7, clientY: 9, ctrlKey: false })
  const handled = vi.fn()
  fake.screen.addEventListener('wheel', handled)
  fake.screen.dispatchEvent(real)
  expect(real.defaultPrevented).toBe(true)
  expect(fake.forwarded).toHaveLength(3)
  for (const e of fake.forwarded) {
    expect([e.deltaY, e.deltaMode, e.clientX, e.clientY]).toEqual([-1, WHEEL_DELTA_MODE.line, 7, 9])
  }
})

test('horizontal (Shift) wheel and x10 click-only reporting stay with xterm', () => {
  const x10 = fakeTerminal('x10', 'normal')
  installWheelScroll(x10.term, settings)
  expect(x10.call(px(CELL_PX))).toBe(true)
  const alt = fakeTerminal('vt200', 'alternate')
  installWheelScroll(alt.term, settings)
  expect(alt.call(px(CELL_PX, { shiftKey: true }))).toBe(true)
})
