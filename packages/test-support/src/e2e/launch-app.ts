import { mkdtempSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron, type ElectronApplication, type Page } from '@playwright/test'
import {
  type DialogStubs,
  ShellTestIds,
  TEST_DIALOG_STUBS_ENV,
  TEST_MODE_ENABLED,
  TEST_MODE_ENV,
  USER_DATA_ENV,
} from '@pragma/sdk'
import { findRepoRoot } from '../node/repo-root'
import {
  BUILD_OUT_DIRS,
  BUILD_VARIANTS,
  type BuildVariant,
  CONSOLE_EVENT,
  DESKTOP_DIR,
  E2E_TEMP_PREFIX,
  ELECTRON_PACKAGE,
  LAUNCH_TIMEOUT_MS,
  MAIN_ENTRY,
} from './constants'
import { writeDisabledModules } from './settings-file'

export interface LaunchOptions {
  variant?: BuildVariant
  /** A packaged binary (phase 12 smoke tests); launched with no main-script argument, `variant` is ignored. */
  executablePath?: string
  /** Kept on `close()`; a temporary directory is created (and removed) when omitted. */
  userDataDir?: string
  env?: Record<string, string>
  disabledModules?: string[]
  dialogStubs?: DialogStubs
}

export interface LaunchedApp {
  app: ElectronApplication
  window: Page
  userDataDir: string
  /** Every renderer console line of this launch, `type: text`. */
  console: string[]
  /** Closes the app and launches it again on the same userData. */
  restart(): Promise<LaunchedApp>
  close(): Promise<void>
}

/** In Node, `require('electron')` is the path of the Electron binary. */
const electronBinary = (): string => createRequire(import.meta.url)(ELECTRON_PACKAGE) as string

function processEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) out[k] = v
  return out
}

function launchArgs(opts: LaunchOptions): { executablePath: string; args: string[] } {
  if (opts.executablePath) return { executablePath: opts.executablePath, args: [] }
  const outDir = BUILD_OUT_DIRS[opts.variant ?? BUILD_VARIANTS.default]
  return { executablePath: electronBinary(), args: [join(findRepoRoot(), DESKTOP_DIR, outDir, MAIN_ENTRY)] }
}

/** Waits for the first window that is the shell (not devtools) and for `shellReady`. */
async function shellWindow(app: ElectronApplication): Promise<Page> {
  const window = await app.firstWindow({ timeout: LAUNCH_TIMEOUT_MS })
  await window.getByTestId(ShellTestIds.shellReady).waitFor({ state: 'attached', timeout: LAUNCH_TIMEOUT_MS })
  return window
}

/** Collects console lines of every window the app opens (including windows recreated on `activate`). */
function collectConsole(app: ElectronApplication, lines: string[]): void {
  const attach = (page: Page): void => {
    page.on(CONSOLE_EVENT, (m) => lines.push(`${m.type()}: ${m.text()}`))
  }
  for (const w of app.windows()) attach(w)
  app.on('window', attach)
}

/** Launches the built app in test mode on a temp (or given) userData (§10.4). */
export function launchApp(opts: LaunchOptions = {}): Promise<LaunchedApp> {
  const owned = opts.userDataDir === undefined
  const userDataDir = opts.userDataDir ?? mkdtempSync(join(tmpdir(), E2E_TEMP_PREFIX))
  if (opts.disabledModules) writeDisabledModules(userDataDir, opts.disabledModules)
  return start({ ...opts, userDataDir }, owned)
}

async function start(opts: LaunchOptions & { userDataDir: string }, owned: boolean): Promise<LaunchedApp> {
  const { userDataDir } = opts
  const removeDir = (): void => {
    if (owned) rmSync(userDataDir, { recursive: true, force: true })
  }
  const env: Record<string, string> = {
    ...processEnv(),
    ...opts.env,
    [USER_DATA_ENV]: userDataDir,
    [TEST_MODE_ENV]: TEST_MODE_ENABLED,
  }
  if (opts.dialogStubs) env[TEST_DIALOG_STUBS_ENV] = JSON.stringify(opts.dialogStubs)
  const console: string[] = []
  const app = await _electron.launch({ ...launchArgs(opts), env, timeout: LAUNCH_TIMEOUT_MS })
  collectConsole(app, console)
  let window: Page
  try {
    window = await shellWindow(app)
  } catch (error) {
    await app.close().catch(() => undefined)
    removeDir()
    throw error
  }
  let closed = false
  const shutdown = async (): Promise<void> => {
    if (closed) return
    closed = true
    await app.close()
  }
  return {
    app,
    window,
    userDataDir,
    console,
    async restart() {
      await shutdown()
      // disabledModules was written once before the first launch; later changes in settings.json win.
      return start({ ...opts, disabledModules: undefined }, owned)
    },
    async close() {
      await shutdown()
      removeDir()
    },
  }
}
