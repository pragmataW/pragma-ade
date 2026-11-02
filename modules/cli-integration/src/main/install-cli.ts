import { execFile } from 'node:child_process'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { DEFAULT_POSIX_INSTALL_SUBDIR, PATH_DELIMITERS, POWERSHELL, WIN32 } from '../constants'
import {
  CLI_BIN_NAME,
  CLI_CMD_SHIM_NAME,
  CLI_ERROR,
  CLI_INSTALL_STATE,
  type CliInstallState,
  type CliInstallStatus,
} from '../contract'
import { CliError } from './cli-error'
import type { CliPaths } from './paths'

export interface UserPathApi {
  get(): Promise<string>
  set(value: string): Promise<void>
}

export interface CliInstallDeps {
  platform: NodeJS.Platform
  home: string
  paths: CliPaths
  /** The login-shell PATH (`ctx.env.getShellEnv()`), undefined when unknown. */
  shellPath: () => Promise<string | undefined>
  /** Windows user PATH (registry), never `setx`. */
  userPath: UserPathApi
}

const UTF8 = 'utf8'

export function defaultInstallDir(platform: NodeJS.Platform, home: string, binDir: string): string {
  return platform === WIN32 ? binDir : join(home, ...DEFAULT_POSIX_INSTALL_SUBDIR)
}

const sameDir = (a: string, b: string, win: boolean): boolean =>
  win ? resolve(a).toLowerCase() === resolve(b).toLowerCase() : resolve(a) === resolve(b)
const entries = (pathValue: string, win: boolean): string[] =>
  pathValue.split(win ? PATH_DELIMITERS.win32 : PATH_DELIMITERS.posix).filter(Boolean)
const onPath = (pathValue: string, dir: string, win: boolean): boolean =>
  entries(pathValue, win).some((e) => sameDir(e, dir, win))

function linkPathOf(dir: string, d: CliInstallDeps): string {
  if (d.platform !== WIN32) return join(dir, CLI_BIN_NAME)
  return sameDir(dir, d.paths.binDir, true) ? d.paths.shimPath : join(dir, CLI_CMD_SHIM_NAME)
}

/** posix: our symlink / nothing / something else at `<dir>/pragma`. */
function posixState(link: string, shimPath: string): CliInstallState {
  let stat: ReturnType<typeof lstatSync>
  try {
    stat = lstatSync(link)
  } catch {
    return CLI_INSTALL_STATE.not_installed
  }
  if (!stat.isSymbolicLink()) return CLI_INSTALL_STATE.conflict
  const target = resolve(dirname(link), readlinkSync(link))
  return target === resolve(shimPath) ? CLI_INSTALL_STATE.installed : CLI_INSTALL_STATE.conflict
}

/** win32: the copied `.cmd` must equal our shim, and the dir must be on the user PATH. */
async function winState(dir: string, link: string, d: CliInstallDeps): Promise<CliInstallState> {
  const ours =
    link === d.paths.shimPath || (existsSync(link) && readFileSync(link, UTF8) === readFileSync(d.paths.shimPath, UTF8))
  if (!ours && existsSync(link)) return CLI_INSTALL_STATE.conflict
  return ours && onPath(await d.userPath.get(), dir, true)
    ? CLI_INSTALL_STATE.installed
    : CLI_INSTALL_STATE.not_installed
}

async function dirOnPath(dir: string, d: CliInstallDeps): Promise<boolean | null> {
  const win = d.platform === WIN32
  const value = win ? await d.userPath.get() : await d.shellPath()
  return value === undefined ? null : onPath(value, dir, win)
}

export async function cliInstallStatus(dir: string, d: CliInstallDeps): Promise<CliInstallStatus> {
  const linkPath = linkPathOf(dir, d)
  const state = d.platform === WIN32 ? await winState(dir, linkPath, d) : posixState(linkPath, d.paths.shimPath)
  return {
    shimPath: d.paths.shimPath,
    bundleFound: existsSync(d.paths.bundlePath),
    installDir: dir,
    linkPath,
    state,
    dirOnPath: await dirOnPath(dir, d),
  }
}

async function addToUserPath(dir: string, api: UserPathApi): Promise<void> {
  const current = await api.get()
  if (!onPath(current, dir, true)) await api.set([...entries(current, true), dir].join(PATH_DELIMITERS.win32))
}

async function removeFromUserPath(dir: string, api: UserPathApi): Promise<void> {
  const current = await api.get()
  const kept = entries(current, true).filter((e) => !sameDir(e, dir, true))
  if (kept.length !== entries(current, true).length) await api.set(kept.join(PATH_DELIMITERS.win32))
}

/** Never overwrites something that is not ours (`conflict`). */
export async function installCli(dir: string, d: CliInstallDeps): Promise<CliInstallStatus> {
  const status = await cliInstallStatus(dir, d)
  if (status.state === CLI_INSTALL_STATE.conflict)
    throw new CliError(
      CLI_ERROR.conflict,
      `${status.linkPath} already exists and is not Pragma's; remove it or pick another folder.`,
    )
  if (status.state === CLI_INSTALL_STATE.installed) return status
  mkdirSync(dir, { recursive: true })
  if (d.platform !== WIN32) symlinkSync(d.paths.shimPath, status.linkPath)
  else {
    if (status.linkPath !== d.paths.shimPath) copyFileSync(d.paths.shimPath, status.linkPath)
    await addToUserPath(dir, d.userPath)
  }
  return cliInstallStatus(dir, d)
}

/** Removes only what is ours. */
export async function uninstallCli(dir: string, d: CliInstallDeps): Promise<CliInstallStatus> {
  const status = await cliInstallStatus(dir, d)
  if (status.state === CLI_INSTALL_STATE.conflict) return status
  if (d.platform !== WIN32) {
    if (status.state === CLI_INSTALL_STATE.installed) unlinkSync(status.linkPath)
  } else {
    if (status.linkPath !== d.paths.shimPath && existsSync(status.linkPath)) unlinkSync(status.linkPath)
    await removeFromUserPath(dir, d.userPath)
  }
  return cliInstallStatus(dir, d)
}

const run = promisify(execFile)

/** The Windows user PATH through PowerShell (registry `HKCU\Environment`; `setx` would truncate at 1024 chars). */
export function windowsUserPath(): UserPathApi {
  return {
    async get() {
      const { stdout } = await run(POWERSHELL.exe, [...POWERSHELL.args, POWERSHELL.getUserPath])
      return stdout.trim()
    },
    async set(value) {
      await run(POWERSHELL.exe, [...POWERSHELL.args, POWERSHELL.setUserPath], {
        env: { ...process.env, [POWERSHELL.valueEnv]: value },
      })
    },
  }
}
