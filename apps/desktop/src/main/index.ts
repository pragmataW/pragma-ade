import { APP_NAME, TEST_MODE_ENABLED, TEST_MODE_ENV } from '@pragma/sdk'
import { createMainHost } from '@pragma/sdk/runtime/main'
import { app, BrowserWindow } from 'electron'
import { DARWIN, DISPOSE_TIMEOUT_MS, E2E_HEADED_ENABLED, E2E_HEADED_ENV, HIDDEN_ACTIVATION_POLICY } from '../constants'
import { coreLocales, mainModules } from '../generated/modules.main'
import { initialDialogStubs, registerShellHandlers } from './app-handlers'
import { installAppMenu } from './app-menu'
import { createStubbedDialogs } from './dialog-stubs'
import { createElectronPlatform } from './electron-platform'
import { createElectronTransport } from './electron-transport'
import { installAppShortcutForwarding, registerCoreShortcuts } from './global-shortcuts'
import { resolveUserDataDir } from './user-data'
import { createWindowViewContainer } from './view-container'
import { createMainWindow } from './window'
import { registerWindowHandlers, watchWindowChrome } from './window-chrome'

const USER_DATA = 'userData'
const ACTIVATE = 'activate'
const BEFORE_QUIT = 'before-quit'
const ALL_CLOSED = 'window-all-closed'
const SECOND_INSTANCE = 'second-instance'

const testMode = process.env[TEST_MODE_ENV] === TEST_MODE_ENABLED
// E2E runs stay off-screen so the machine stays usable while suites run in parallel.
const hiddenWindow = testMode && process.env[E2E_HEADED_ENV] !== E2E_HEADED_ENABLED
app.setName(APP_NAME)
app.setPath(USER_DATA, resolveUserDataDir(process.env, app.getPath(USER_DATA)))
// One app per userData: a second instance would start its own editor server and pty daemon on the same state and
// break both. It hands over to the running one (which comes to the front) and quits.
const primary = app.requestSingleInstanceLock()
if (!primary) app.quit()

async function main(): Promise<void> {
  await app.whenReady()
  if (hiddenWindow && process.platform === DARWIN) app.setActivationPolicy(HIDDEN_ACTIVATION_POLICY)
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
  installAppMenu(process.platform)
  let current: BrowserWindow | undefined
  registerWindowHandlers(host.router, () => (current && !current.isDestroyed() ? current : undefined))

  const openWindow = (): BrowserWindow => {
    const win = createMainWindow({
      title: host.i18n.t('core:app.title'),
      theme: host.theme.get(),
      hidden: hiddenWindow,
    })
    current = win
    watchWindowChrome(win, { router: host.router, theme: host.theme, platform: process.platform })
    viewContainer?.setWindow(win)
    host.nativeViews.reattachAll()
    installAppShortcutForwarding(win, host.shortcuts, host.commands)
    return win
  }
  openWindow()
  app.on(SECOND_INSTANCE, () => {
    const win = current && !current.isDestroyed() ? current : openWindow()
    if (win.isMinimized()) win.restore()
    win.focus()
  })
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

if (primary) void main()
