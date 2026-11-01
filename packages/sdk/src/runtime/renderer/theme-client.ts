import { CoreIpc } from '../../common/core-ipc'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { ThemeApi, ThemeState } from '../../common/theme'
import type { IpcClient } from './ipc-client'

/** `ctx.theme` in the renderer: `core.theme.get` once, then `core.theme.changed`. */
export function createThemeClient(initial: ThemeState, ipc: IpcClient): ThemeApi & Disposable {
  let state = initial
  const listeners = new Set<(s: ThemeState) => void>()
  const sub = ipc.subscribe(CoreIpc.themeChanged, (next) => {
    state = next
    for (const cb of [...listeners]) cb(state)
  })
  return {
    get: () => state,
    onChange(cb) {
      listeners.add(cb)
      return toDisposable(() => listeners.delete(cb))
    },
    dispose: () => sub.dispose(),
  }
}
