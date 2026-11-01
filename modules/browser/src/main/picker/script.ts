import { collectElementContext } from './page/collect'
import { installPicker } from './page/overlay'
import { buildDomPath, buildSelector, selectorKit } from './page/selector'
import type { OverlayOpts } from './page/types'

export const PICKER_ACTION = {
  arm: 'arm',
  awaitPick: 'awaitPick',
  cancel: 'cancel',
  hideOverlay: 'hideOverlay',
  showOverlay: 'showOverlay',
  teardown: 'teardown',
  debugState: 'debugState',
} as const
export type PickerAction = (typeof PICKER_ACTION)[keyof typeof PICKER_ACTION]
export const PICKER_ACTIONS = Object.values(PICKER_ACTION) as readonly PickerAction[]
export type PickerScriptOpts = OverlayOpts

/** The page library, built once from the self-contained functions' sources. */
const LIB_SOURCE = `{
  selectorKit: (${selectorKit.toString()}),
  buildSelector: (${buildSelector.toString()}),
  buildDomPath: (${buildDomPath.toString()}),
  collectElementContext: (${collectElementContext.toString()}),
  installPicker: (${installPicker.toString()}),
}`

/** `p` is `globalThis.__pragmaPicker` (may be undefined), `o` the options, `lib` the page library. */
export const ACTION_BODIES: Record<PickerAction, string> = {
  arm: 'const picker = (g.__pragmaPicker ??= lib.installPicker(o)); picker.arm(o); return true',
  awaitPick: "return p ? p.awaitPick() : { kind: 'cancelled' }",
  cancel: 'p?.cancel(); return true',
  hideOverlay: 'p?.hideOverlay(); return true',
  showOverlay: 'p?.showOverlay(); return true',
  teardown: 'p?.teardown(); return true',
  debugState: 'return p ? p.debugState() : { armed: false, hoverSelector: null, boxVisible: false, marks: 0 }',
}

/** One expression for `executeJavaScriptInIsolatedWorld`; `awaitPick` evaluates to a Promise Electron unwraps. */
export function buildPickerScript(action: PickerAction, opts: PickerScriptOpts): string {
  return `(() => {
  const g = globalThis
  const o = ${JSON.stringify(opts)}
  const lib = (g.__pragmaPickerLib ??= ${LIB_SOURCE})
  const p = g.__pragmaPicker
  ${ACTION_BODIES[action]}
})()`
}
