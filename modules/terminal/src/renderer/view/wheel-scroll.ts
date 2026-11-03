import type { Terminal } from '@xterm/xterm'
import {
  ALT_BUFFER_TYPE,
  MAX_WHEEL_STEPS_PER_EVENT,
  WHEEL_DELTA_MODE,
  WHEEL_EVENT,
  WHEEL_REPORTING_MODES,
  XTERM_SCREEN_SELECTOR,
} from '../../constants'
import type { TerminalSettings } from '../../contract'

export interface WheelScale {
  /** CSS pixels of one terminal row. */
  cellHeightPx: number
  rows: number
  sensitivity: number
  fastSensitivity: number
}

type WheelSettings = Pick<TerminalSettings, 'scrollSensitivity' | 'fastScrollSensitivity' | 'fontSize'>

/** Lines of travel of one wheel event (fractional for trackpad pixel deltas). */
function wheelLines(e: WheelEvent, s: WheelScale): number {
  const fast = e.altKey || e.ctrlKey ? s.fastSensitivity : 1
  const factor = s.sensitivity * fast
  if (e.deltaMode === WHEEL_DELTA_MODE.line) return e.deltaY * factor
  if (e.deltaMode === WHEEL_DELTA_MODE.page) return e.deltaY * s.rows * factor
  return (e.deltaY / s.cellHeightPx) * factor
}

/** Turns wheel deltas into whole line steps, carrying the remainder (reset when the direction flips). */
export function createWheelStepper() {
  let partial = 0
  return {
    steps(e: WheelEvent, s: WheelScale): number {
      const lines = wheelLines(e, s)
      if (Math.sign(lines) !== Math.sign(partial)) partial = 0
      partial += lines
      const whole = Math.trunc(partial)
      partial -= whole
      return Math.max(-MAX_WHEEL_STEPS_PER_EVENT, Math.min(MAX_WHEEL_STEPS_PER_EVENT, whole))
    },
    reset(): void {
      partial = 0
    },
  }
}

const isReportingMode = (mode: string): boolean => (WHEEL_REPORTING_MODES as readonly string[]).includes(mode)

/** The program, not xterm's scrollback viewport, receives the wheel (mouse reports or arrow keys). */
const programOwnsWheel = (term: Terminal): boolean =>
  isReportingMode(term.modes.mouseTrackingMode) || term.buffer.active.type === ALT_BUFFER_TYPE

/** The rendered row height; before the first render, the font size (the app keeps xterm's line height 1). */
function cellHeightPx(term: Terminal, fontSize: number): number {
  const screen = term.element?.querySelector<HTMLElement>(XTERM_SCREEN_SELECTOR)
  const measured = screen && term.rows > 0 ? screen.clientHeight / term.rows : 0
  return measured > 0 ? measured : fontSize
}

/**
 * xterm 6 sends at most one wheel report (or arrow key) per wheel event and scales trackpad pixel deltas by 0.3,
 * so programs that own the wheel (Claude Code's fullscreen mode, vim, less) scroll a fraction of the distance
 * the fingers travel. This re-dispatches one line-mode wheel event per line of travel; xterm reports each one.
 * Normal-buffer scrollback keeps xterm's own viewport scrolling (the same as VS Code's terminal).
 */
export function installWheelScroll(term: Terminal, settings: () => WheelSettings): void {
  const stepper = createWheelStepper()
  const forwarded = new WeakSet<Event>()
  term.attachCustomWheelEventHandler((e) => {
    if (forwarded.has(e) || e.shiftKey || !programOwnsWheel(term)) return true
    e.preventDefault()
    const { scrollSensitivity, fastScrollSensitivity, fontSize } = settings()
    const steps = stepper.steps(e, {
      cellHeightPx: cellHeightPx(term, fontSize),
      rows: term.rows,
      sensitivity: scrollSensitivity,
      fastSensitivity: fastScrollSensitivity,
    })
    const target = e.target instanceof EventTarget ? e.target : term.element
    for (let i = 0; i < Math.abs(steps); i++) {
      const step = new WheelEvent(WHEEL_EVENT, {
        bubbles: true,
        cancelable: true,
        deltaMode: WHEEL_DELTA_MODE.line,
        deltaY: Math.sign(steps),
        clientX: e.clientX,
        clientY: e.clientY,
        screenX: e.screenX,
        screenY: e.screenY,
      })
      forwarded.add(step)
      target?.dispatchEvent(step)
    }
    return false
  })
}
