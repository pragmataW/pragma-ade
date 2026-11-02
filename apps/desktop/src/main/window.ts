import { join } from 'node:path'
import { palettes } from '@pragma/ui/tokens'
import { BrowserWindow } from 'electron'
import { DARWIN, PRELOAD_FILE, RENDERER_FILE, RENDERER_URL_ENV, TRAFFIC_LIGHT_POSITION, WINDOW } from '../constants'
import appIcon from './assets/icon.png?asset'

const READY_TO_SHOW = 'ready-to-show'
const WILL_NAVIGATE = 'will-navigate'
const DENY = { action: 'deny' } as const
const DID_FINISH_LOAD = 'did-finish-load'

/**
 * The single app window: sandboxed renderer, no navigation away from the app, no popups.
 * `hidden` (E2E runs) never shows the window and keeps it painting at full speed while hidden.
 */
export function createMainWindow(opts: { title: string; hidden?: boolean }): BrowserWindow {
  const hidden = opts.hidden === true
  const isMac = process.platform === DARWIN
  const win = new BrowserWindow({
    width: WINDOW.width,
    height: WINDOW.height,
    minWidth: WINDOW.minWidth,
    minHeight: WINDOW.minHeight,
    title: opts.title,
    show: false,
    backgroundColor: palettes.vscode.dark.bg,
    // macOS takes the Dock icon from the app bundle; Linux and Windows use the window icon.
    ...(isMac
      ? { titleBarStyle: 'hiddenInset' as const, trafficLightPosition: TRAFFIC_LIGHT_POSITION }
      : { icon: appIcon }),
    webPreferences: {
      preload: join(import.meta.dirname, PRELOAD_FILE),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !hidden,
    },
  })
  if (!hidden) win.once(READY_TO_SHOW, () => win.show())
  win.webContents.setWindowOpenHandler(() => DENY)
  const devUrl = process.env[RENDERER_URL_ENV]
  const appUrl = devUrl ?? new URL(`file://${join(import.meta.dirname, RENDERER_FILE)}`).href
  win.webContents.on(WILL_NAVIGATE, (event, url) => {
    if (!url.startsWith(appUrl)) event.preventDefault()
  })
  win.webContents.on(DID_FINISH_LOAD, () => void win.webContents.setVisualZoomLevelLimits(1, 1))
  if (devUrl) void win.loadURL(devUrl)
  else void win.loadFile(join(import.meta.dirname, RENDERER_FILE))
  return win
}
