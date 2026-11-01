/// <reference lib="dom" />
// Adapted from stablyai/orca src/main/browser/grab-guest-overlay-script.ts (MIT) — see THIRD_PARTY_NOTICES.md
//
// Self-contained (see selector.ts): injected with `Function.prototype.toString` and run in an isolated world only.
import type { InstalledPicker, OverlayOpts, PickerDebugState, PickerGlobal, PickerLib, PickOutcome } from './types'

/**
 * The picker overlay: a closed-shadow host with a full-viewport shield, hover box, label chip and hint; window-capture
 * listeners swallow every press so the page never sees the click. A pick keeps a mark on the element until reload.
 */
export function installPicker(initial: OverlayOpts): InstalledPicker {
  const lib = (globalThis as PickerGlobal).__pragmaPickerLib as PickerLib
  const doc = document
  const DIV = 'div'
  const NONE = 'none'
  const HIDDEN = 'hidden'
  const CAPTURE = true
  const PICK_EVENT = 'click'
  const PRESS = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', PICK_EVENT, 'dblclick', 'auxclick', 'contextmenu']
  const MOVE_EVENT = 'mousemove'
  const KEY_EVENT = 'keydown'
  const REFLOW_EVENTS = ['scroll', 'resize']
  const ESCAPE = 'Escape'
  const MAX_Z = '2147483647'
  let opts = initial
  let armed = false
  let hover: Element | null = null
  let waiter: ((o: PickOutcome) => void) | null = null
  let outcome: PickOutcome | null = null
  let frame = 0
  const marks: { el: Element; box: HTMLElement }[] = []

  const div = (css: string): HTMLElement => {
    const el = doc.createElement(DIV)
    el.style.cssText = css
    return el
  }
  const host = div(`position:fixed;inset:0;z-index:${MAX_Z};`)
  host.setAttribute('data-pragma-picker-host', '')
  const shadow = host.attachShadow({ mode: 'closed' })
  const shield = div('position:fixed;inset:0;pointer-events:auto;cursor:crosshair;background:transparent;')
  const box = div('position:fixed;pointer-events:none;box-sizing:border-box;border-radius:2px;display:none;')
  const chip = div(
    'position:fixed;pointer-events:none;display:none;padding:2px 6px;border-radius:4px;color:#fff;white-space:nowrap;font:11px/16px ui-monospace,Menlo,monospace;',
  )
  const hint = div(
    'position:fixed;left:50%;top:8px;transform:translateX(-50%);pointer-events:none;padding:4px 10px;border-radius:6px;background:rgba(20,20,20,.85);color:#fff;font:12px/18px system-ui,sans-serif;',
  )
  shadow.append(shield, box, chip, hint)
  const marksHost = div(`position:fixed;inset:0;pointer-events:none;z-index:${MAX_Z};`)
  marksHost.setAttribute('data-pragma-picker-marks', '')

  const paint = (target: HTMLElement, el: Element, fill: boolean): void => {
    const r = el.getBoundingClientRect()
    const s = target.style
    s.left = `${r.x}px`
    s.top = `${r.y}px`
    s.width = `${r.width}px`
    s.height = `${r.height}px`
    s.border = `2px solid ${opts.accent}`
    s.background = fill ? `color-mix(in srgb, ${opts.accent} 14%, transparent)` : NONE
  }
  const showHover = (el: Element | null): void => {
    hover = el
    box.style.display = el ? '' : NONE
    chip.style.display = el ? '' : NONE
    if (!el) return
    paint(box, el, true)
    const r = el.getBoundingClientRect()
    chip.textContent = `${lib.buildSelector(el, opts)}  ${Math.round(r.width)} × ${Math.round(r.height)}`
    chip.style.background = opts.accent
    chip.style.left = `${Math.max(0, r.x)}px`
    chip.style.top = `calc(${r.bottom}px + 4px)`
  }
  const hitTest = (x: number, y: number): Element | null =>
    (doc.elementsFromPoint?.(x, y) ?? []).find((el) => el !== host && !host.contains(el) && el !== marksHost) ?? null

  const settle = (o: PickOutcome): void => {
    if (waiter) {
      waiter(o)
      waiter = null
    } else outcome = o
  }
  const listen = (on: boolean): void => {
    const method = on ? 'addEventListener' : 'removeEventListener'
    for (const type of PRESS) window[method](type, onPress as EventListener, CAPTURE)
    window[method](MOVE_EVENT, onMove as EventListener, CAPTURE)
    window[method](KEY_EVENT, onKey as EventListener, CAPTURE)
  }
  const disarm = (): void => {
    armed = false
    listen(false)
    showHover(null)
    host.remove()
  }
  const reflow = (): void => {
    frame = 0
    for (const m of marks) paint(m.box, m.el, false)
  }
  const scheduleReflow = (): void => {
    if (frame) return
    if (typeof requestAnimationFrame === 'function') frame = requestAnimationFrame(reflow)
    else reflow()
  }
  const addMark = (el: Element): void => {
    if (!marksHost.isConnected) doc.documentElement.append(marksHost)
    const mark = div('position:fixed;pointer-events:none;box-sizing:border-box;border-radius:2px;')
    marksHost.append(mark)
    marks.push({ el, box: mark })
    paint(mark, el, false)
    if (marks.length === 1) for (const type of REFLOW_EVENTS) window.addEventListener(type, scheduleReflow, CAPTURE)
  }
  const pick = (el: Element): void => {
    const element = lib.collectElementContext(el, opts)
    el.setAttribute(opts.pickAttr, opts.nonce)
    disarm()
    addMark(el)
    settle({ kind: 'picked', element, nonce: opts.nonce })
  }

  function onMove(e: MouseEvent): void {
    showHover(hitTest(e.clientX, e.clientY))
  }
  function onPress(e: MouseEvent): void {
    e.preventDefault()
    e.stopImmediatePropagation()
    if (e.type !== PICK_EVENT) return
    const target = hover ?? (e.target instanceof Element && e.target !== host ? e.target : null)
    if (target) pick(target)
  }
  function onKey(e: KeyboardEvent): void {
    if (e.key !== ESCAPE) return
    e.preventDefault()
    e.stopImmediatePropagation()
    api.cancel()
  }

  const api: InstalledPicker = {
    arm(next?: OverlayOpts) {
      if (next) opts = next
      outcome = null
      hint.textContent = opts.hint
      if (armed) return
      armed = true
      doc.documentElement.append(host)
      listen(true)
    },
    awaitPick() {
      if (outcome) {
        const ready = outcome
        outcome = null
        return Promise.resolve(ready)
      }
      return new Promise<PickOutcome>((resolve) => {
        waiter = resolve
      })
    },
    cancel() {
      if (armed) disarm()
      settle({ kind: 'cancelled' })
    },
    hideOverlay() {
      host.style.visibility = HIDDEN
      marksHost.style.visibility = HIDDEN
    },
    showOverlay() {
      host.style.visibility = ''
      marksHost.style.visibility = ''
    },
    teardown() {
      api.cancel()
      for (const type of REFLOW_EVENTS) window.removeEventListener(type, scheduleReflow, CAPTURE)
      for (const m of marks.splice(0)) m.el.removeAttribute(opts.pickAttr)
      marksHost.remove()
      marksHost.replaceChildren()
      const g = globalThis as PickerGlobal
      delete g.__pragmaPicker
    },
    debugState(): PickerDebugState {
      return {
        armed,
        hoverSelector: hover ? lib.buildSelector(hover, opts) : null,
        boxVisible: armed && box.style.display !== NONE,
        marks: marks.length,
      }
    },
  }
  return api
}
