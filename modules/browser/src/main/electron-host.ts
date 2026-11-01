import type { MainContext } from '@pragma/sdk/main'
import { type Input, session, WebContentsView } from 'electron'
import { ALLOWED_PERMISSIONS, RIGHT_TAB_ID, VIEW_INSET_TOP_PX } from '../constants'
import type { BrowserHost, GuestLike, ViewLike } from './guest'
import { resolveShortcut, type ShortcutAction } from './shortcuts'

const BEFORE_INPUT = 'before-input-event'
const allowed = (permission: string): boolean => (ALLOWED_PERMISSIONS as readonly string[]).includes(permission)

/** The real `BrowserHost`: sandboxed WebContentsViews, SDK native-view placement, SDK `shell.openExternal`. */
export function createElectronHost(
  ctx: MainContext,
  onShortcut: (guest: GuestLike, action: ShortcutAction) => void,
): BrowserHost & { native(view: ViewLike): WebContentsView } {
  const secured = new Set<string>()
  const secure = (partition: string): void => {
    if (secured.has(partition)) return
    secured.add(partition)
    const ses = session.fromPartition(partition)
    ses.setPermissionRequestHandler((_wc, permission, callback) => callback(allowed(permission)))
    ses.setPermissionCheckHandler((_wc, permission) => allowed(permission))
  }
  const native = (view: ViewLike): WebContentsView => view as unknown as WebContentsView
  return {
    native,
    createView(partition) {
      secure(partition)
      const view = new WebContentsView({
        webPreferences: {
          partition,
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          webSecurity: true,
          safeDialogs: true,
        },
      })
      const guest = view.webContents as unknown as GuestLike
      view.webContents.on(BEFORE_INPUT, (event, input: Input) => {
        const action = resolveShortcut(input, process.platform)
        if (!action) return
        event.preventDefault()
        onShortcut(guest, action)
      })
      return view as unknown as ViewLike
    },
    attach: (viewId, view) =>
      ctx.nativeViews.attach(viewId, native(view), { panelTabId: RIGHT_TAB_ID, inset: { top: VIEW_INSET_TOP_PX } }),
    detach: (viewId) => ctx.nativeViews.detach(viewId),
    show: (viewId) => ctx.nativeViews.show(viewId),
    hide: (viewId) => ctx.nativeViews.hide(viewId),
    freeze: (viewId) => ctx.nativeViews.freeze(viewId),
    unfreeze: (viewId) => ctx.nativeViews.unfreeze(viewId),
    openExternal: (url) =>
      ctx.shell.openExternal(url).catch((error: unknown) => ctx.log.warn(`could not open ${url} externally`, error)),
    async clearPartition(partition) {
      const ses = session.fromPartition(partition)
      await ses.clearStorageData()
      await ses.clearCache()
    },
    now: () => Date.now(),
  }
}
