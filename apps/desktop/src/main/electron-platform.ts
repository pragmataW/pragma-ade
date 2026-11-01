import { type Disposable, toDisposable } from '@pragma/sdk'
import { type PlatformAdapter, resolveShellEnv } from '@pragma/sdk/runtime/main'
import { app, BrowserWindow, dialog, Notification, nativeTheme, shell } from 'electron'

const EVENTS = {
  focus: 'browser-window-focus',
  blur: 'browser-window-blur',
  updated: 'updated',
  click: 'click',
} as const
const OPEN_FILE = 'openFile'
const OPEN_FOLDER_PROPERTIES: Electron.OpenDialogOptions['properties'] = ['openDirectory', 'createDirectory']
const CONFIRM_INDEX = 0
const CANCEL_INDEX = 1

const parentWindow = (): BrowserWindow | undefined => BrowserWindow.getFocusedWindow() ?? undefined

function showOpen(options: Electron.OpenDialogOptions): Promise<Electron.OpenDialogReturnValue> {
  const win = parentWindow()
  return win ? dialog.showOpenDialog(win, options) : dialog.showOpenDialog(options)
}

function showMessage(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const win = parentWindow()
  return win ? dialog.showMessageBox(win, options) : dialog.showMessageBox(options)
}

function focusChanges(cb: (focused: boolean) => void): Disposable {
  let last = BrowserWindow.getFocusedWindow() !== null
  const check = (): void => {
    const now = BrowserWindow.getFocusedWindow() !== null
    if (now === last) return
    last = now
    cb(now)
  }
  const deferred = (): void => void setImmediate(check)
  app.on(EVENTS.focus, deferred)
  app.on(EVENTS.blur, deferred)
  return toDisposable(() => {
    app.off(EVENTS.focus, deferred)
    app.off(EVENTS.blur, deferred)
  })
}

/** The real Electron implementation of the SDK's only platform seam. */
export function createElectronPlatform(): PlatformAdapter {
  return {
    dialogs: {
      async openFolder(o) {
        const r = await showOpen({
          title: o.title,
          defaultPath: o.defaultPath,
          properties: OPEN_FOLDER_PROPERTIES,
        })
        return r.canceled ? null : (r.filePaths[0] ?? null)
      },
      async openFile(o) {
        const properties: Electron.OpenDialogOptions['properties'] = o.multiple
          ? [OPEN_FILE, 'multiSelections']
          : [OPEN_FILE]
        const r = await showOpen({ title: o.title, filters: o.filters, properties })
        return r.canceled ? null : r.filePaths
      },
      async confirm(o) {
        const r = await showMessage({
          type: o.destructive ? 'warning' : 'question',
          title: o.title,
          message: o.message,
          buttons: [o.confirmLabel, o.cancelLabel],
          defaultId: CONFIRM_INDEX,
          cancelId: CANCEL_INDEX,
        })
        return r.response === CONFIRM_INDEX
      },
    },
    openExternal: (url) => shell.openExternal(url),
    showNotification(n) {
      const notification = new Notification({ title: n.title, body: n.body })
      if (n.onClick) notification.on(EVENTS.click, n.onClick)
      notification.show()
    },
    theme: {
      setSource(mode) {
        nativeTheme.themeSource = mode
      },
      shouldUseDark: () => nativeTheme.shouldUseDarkColors,
      onUpdated(cb) {
        nativeTheme.on(EVENTS.updated, cb)
        return toDisposable(() => nativeTheme.off(EVENTS.updated, cb))
      },
    },
    window: { isFocused: () => BrowserWindow.getFocusedWindow() !== null, onFocusChange: focusChanges },
    getShellEnv: () => resolveShellEnv({ platform: process.platform }),
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
    platform: process.platform,
  }
}
