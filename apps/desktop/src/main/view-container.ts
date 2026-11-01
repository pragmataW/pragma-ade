import { type Logger, toKeyInput } from '@pragma/sdk'
import type { CommandRegistry, NativeViewLike, ShortcutRegistry, ViewContainer } from '@pragma/sdk/runtime/main'
import type { BrowserWindow, WebContentsView } from 'electron'
import { KEY_DOWN } from '../constants'

type NativeEntry = NativeViewLike & { native?: WebContentsView }

const NATIVE_VIEW_FOCUS = 'native-view'
const BEFORE_INPUT = 'before-input-event'

/** Adds native views to the current window and forwards global shortcuts typed inside them (§10.2). */
export function createWindowViewContainer(
  shortcuts: ShortcutRegistry,
  commands: Pick<CommandRegistry, 'execute'>,
  log: Logger,
): ViewContainer & { setWindow(win: BrowserWindow): void } {
  let win: BrowserWindow | undefined
  const listening = new WeakSet<WebContentsView>()
  const listen = (native: WebContentsView): void => {
    if (listening.has(native)) return
    listening.add(native)
    native.webContents.on(BEFORE_INPUT, (event, input) => {
      if (input.type !== KEY_DOWN) return
      const spec = shortcuts.match(toKeyInput(input), NATIVE_VIEW_FOCUS)
      if (!spec) return
      event.preventDefault()
      const ref = typeof spec.command === 'string' ? { id: spec.command } : spec.command
      void commands.execute(ref.id, ref.args).catch((e) => log.error(`shortcut ${spec.id}`, e))
    })
  }
  return {
    setWindow(next) {
      win = next
    },
    add(view) {
      const native = (view as NativeEntry).native
      if (!native) return
      listen(native)
      win?.contentView.addChildView(native)
    },
    remove(view) {
      const native = (view as NativeEntry).native
      if (native && win && !win.isDestroyed()) win.contentView.removeChildView(native)
    },
  }
}
