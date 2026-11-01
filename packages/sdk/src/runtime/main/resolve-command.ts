import { constants } from 'node:fs'
import { access as fsAccess } from 'node:fs/promises'
import { posix, win32 } from 'node:path'
import { PLATFORM } from '../../constants'

const DEFAULT_PATHEXT = '.COM;.EXE;.BAT;.CMD'
const WIN_PATH_KEYS = ['Path', 'PATH'] as const
const POSIX_PATH_KEY = 'PATH'
const SEPARATORS = /[\\/]/

export type AccessFn = (path: string) => Promise<void>

const defaultAccess: AccessFn = (path) => fsAccess(path, constants.X_OK)

async function firstAccessible(candidates: string[], access: AccessFn): Promise<string | null> {
  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // not executable here; try the next candidate
    }
  }
  return null
}

function windowsNames(cmd: string, env: Record<string, string | undefined>): string[] {
  const exts = (env.PATHEXT ?? DEFAULT_PATHEXT).split(';').filter(Boolean)
  const hasExt = exts.some((ext) => cmd.toLowerCase().endsWith(ext.toLowerCase()))
  return hasExt ? [cmd] : exts.map((ext) => `${cmd}${ext}`)
}

/** Finds `cmd` on the PATH of `env` (pure apart from `access`). Returns an absolute path or null. */
export async function resolveCommand(
  cmd: string,
  opts: { env: Record<string, string | undefined>; platform: string; access?: AccessFn },
): Promise<string | null> {
  const access = opts.access ?? defaultAccess
  if (SEPARATORS.test(cmd)) return firstAccessible([cmd], access)
  const isWin = opts.platform === PLATFORM.win32
  const path = isWin ? win32 : posix
  const pathValue = isWin ? WIN_PATH_KEYS.map((k) => opts.env[k]).find(Boolean) : opts.env[POSIX_PATH_KEY]
  const dirs = (pathValue ?? '').split(path.delimiter).filter(Boolean)
  const names = isWin ? windowsNames(cmd, opts.env) : [cmd]
  return firstAccessible(
    dirs.flatMap((dir) => names.map((name) => path.join(dir, name))),
    access,
  )
}
