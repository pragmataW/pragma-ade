/** IPC channel names shared by main and the preload (the only two Electron channels the app uses). */
export const INVOKE_CHANNEL = 'pragma:invoke'
export const EVENT_CHANNEL = 'pragma:event'

export const RENDERER_URL_ENV = 'ELECTRON_RENDERER_URL'

export const WINDOW = { width: 1440, height: 900, minWidth: 1024, minHeight: 640 } as const
export const TRAFFIC_LIGHT_POSITION = { x: 14, y: 12 } as const
export const PRELOAD_FILE = '../preload/index.cjs'
export const RENDERER_FILE = '../renderer/index.html'
export const DARWIN = 'darwin'
/** In test mode the window stays hidden and the app never takes focus; set this to `1` to watch an E2E run. */
export const E2E_HEADED_ENV = 'PRAGMA_E2E_HEADED'
export const E2E_HEADED_ENABLED = '1'
/** macOS activation policy for a test run: no Dock icon, never activates over the user's apps. */
export const HIDDEN_ACTIVATION_POLICY = 'accessory'
export const KEY_DOWN = 'keyDown'
/** Upper bound for awaiting module deactivation on quit; a hung module must not keep the app alive. */
export const DISPOSE_TIMEOUT_MS = 5_000

export const PALETTE_ACCELERATOR = 'CmdOrCtrl+K'
export const SETTINGS_ACCELERATOR = 'CmdOrCtrl+,'
