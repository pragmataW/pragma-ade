import { APP_NAME, TEST_MODE_ENABLED, TEST_MODE_ENV } from '@pragma/sdk'
import { createMainHost } from '@pragma/sdk/runtime/main'
import { app, BrowserWindow } from 'electron'
import { DARWIN, DISPOSE_TIMEOUT_MS } from '../constants'
import { coreLocales, mainModules } from '../generated/modules.main'
import { initialDialogStubs, registerShellHandlers } from './app-handlers'
import { createStubbedDialogs } from './dialog-stubs'
import { createElectronPlatform } from './electron-platform'
import { createElectronTransport } from './electron-transport'
import { installAppShortcutForwarding, registerCoreShortcuts } from './global-shortcuts'
import { resolveUserDataDir } from './user-data'
import { createWindowViewContainer } from './view-container'
import { createMainWindow } from './window'

const USER_DATA = 'userData'
const ACTIVATE = 'activate'
const BEFORE_QUIT = 'before-quit'
const ALL_CLOSED = 'window-all-closed'

const testMode = process.env[TEST_MODE_ENV] === TEST_MODE_ENABLED
app.setName(APP_NAME)
app.setPath(USER_DATA, resolveUserDataDir(process.env, app.getPath(USER_DATA)))

async function main(): Promise<void> {
  await app.whenReady()
  const transport = createElectronTransport()
  const platform = createElectronPlatform()
  const stubbed = createStubbedDialogs(platform.dialogs, testMode ? initialDialogStubs(process.env) : {})
  if (testMode) platform.dialogs = stubbed.dialogs
  let viewContainer: ReturnType<typeof createWindowViewContainer> | undefined
  const host = await createMainHost({
    records: mainModules,
    coreLocales,
    userDataDir: app.getPath(USER_DATA),
    transport,
    viewContainer: { add: (v) => viewContainer?.add(v), remove: (v) => viewContainer?.remove(v) },
    platform,
    testMode,
    appVersion: app.getVersion(),
  })
  viewContainer = createWindowViewContainer(host.shortcuts, host.commands, host.log)
  registerShellHandlers(host, { testMode, setDialogStubs: stubbed.setStubs })
  registerCoreShortcuts(host.shortcuts)

  const openWindow = (): BrowserWindow => {
    const win = createMainWindow({ title: host.i18n.t('core:app.title') })
    viewContainer?.setWindow(win)
    host.nativeViews.reattachAll()
    installAppShortcutForwarding(win, host.shortcuts, host.commands)
    return win
  }
  openWindow()
  app.on(ACTIVATE, () => {
    if (app.isReady() && !hasWindows()) openWindow()
  })
  app.on(ALL_CLOSED, () => {
    if (process.platform !== DARWIN) app.quit()
  })
  let disposed = false
  // Quit waits for dispose: native addons (@parcel/watcher) abort the process when their pending unsubscribe work
  // completes during environment teardown, and that crash makes macOS show a launch-blocking "reopen windows?" alert.
  app.on(BEFORE_QUIT, (event) => {
    if (disposed) return
    disposed = true
    event.preventDefault()
    void disposeWithin(host.dispose(), DISPOSE_TIMEOUT_MS, (error) =>
      host.log.error('dispose failed on quit', error),
    ).finally(() => app.quit())
  })
}

function disposeWithin(work: Promise<void>, timeoutMs: number, onError: (error: unknown) => void): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, timeoutMs)
  })
  return Promise.race([work.catch(onError), timeout]).finally(() => clearTimeout(timer))
}

const hasWindows = (): boolean => BrowserWindow.getAllWindows().length > 0

void main()
