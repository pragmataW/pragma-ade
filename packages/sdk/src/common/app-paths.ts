import { PLATFORM } from '../constants'

export const APP_NAME = 'Pragma ADE'
export const USER_DATA_ENV = 'PRAGMA_USER_DATA'

const WIN_SEP = '\\'
const POSIX_SEP = '/'

/** Candidate userData directories in priority order. Pure: no Node imports (shared with 04's client and 10's CLI). */
export function defaultUserDataDirs(opts: {
  platform: string
  home: string
  env: Record<string, string | undefined>
  appName?: string
}): string[] {
  const appName = opts.appName ?? APP_NAME
  const sep = opts.platform === PLATFORM.win32 ? WIN_SEP : POSIX_SEP
  const join = (...parts: string[]): string => parts.join(sep)
  const out: string[] = []
  const override = opts.env[USER_DATA_ENV]
  if (override) out.push(override)
  if (opts.platform === PLATFORM.darwin) out.push(join(opts.home, 'Library', 'Application Support', appName))
  else if (opts.platform === PLATFORM.win32)
    out.push(join(opts.env.APPDATA ?? join(opts.home, 'AppData', 'Roaming'), appName))
  else out.push(join(opts.env.XDG_CONFIG_HOME ?? join(opts.home, '.config'), appName))
  return out
}
