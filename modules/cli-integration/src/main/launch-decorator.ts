import type { LaunchContext, LaunchDecorator, LaunchSpec } from '@pragma/module-agents/contract'
import { BRIDGE_ENV } from '@pragma/module-bridge/contract'
import {
  LAUNCH_DECORATOR_ID,
  LAUNCH_DECORATOR_ORDER,
  PATH_DELIMITERS,
  PATH_KEY_RE,
  PATH_KEYS,
  WIN32,
} from '../constants'
import { ENV_CLI } from '../contract'
import type { CliPaths } from './paths'

/** `dir` first, every other occurrence removed. */
export function prependPathEntry(pathValue: string | undefined, dir: string, delimiter: string): string {
  const rest = (pathValue ?? '').split(delimiter).filter((p) => p && p !== dir)
  return [dir, ...rest].join(delimiter)
}

const pathKeyOf = (env: Readonly<Record<string, string>>): string | undefined =>
  Object.keys(env).find((k) => PATH_KEY_RE.test(k))

/**
 * Puts the shim dir first on PATH and sets `PRAGMA_CLI` / `PRAGMA_BRIDGE_FILE`. Touches only `env`, because 03's
 * `buildLaunchEnv` runs the same decorators for chat sessions (§10.3). `spec.env` is an overlay on the shell env,
 * so PATH is written as a full value.
 */
export function createCliLaunchDecorator(o: {
  paths: CliPaths
  platform: NodeJS.Platform
  basePath: () => Promise<string | undefined>
}): LaunchDecorator {
  const win = o.platform === WIN32
  const delimiter = win ? PATH_DELIMITERS.win32 : PATH_DELIMITERS.posix
  return {
    id: LAUNCH_DECORATOR_ID,
    order: LAUNCH_DECORATOR_ORDER,
    async decorate(spec: LaunchSpec, ctx: LaunchContext): Promise<LaunchSpec> {
      const key =
        pathKeyOf(spec.env) ??
        pathKeyOf(ctx.env) ??
        pathKeyOf(ctx.shellEnv) ??
        (win ? PATH_KEYS.win32 : PATH_KEYS.posix)
      const base = spec.env[key] ?? ctx.env[key] ?? ctx.shellEnv[key] ?? (await o.basePath())
      const env = {
        ...spec.env,
        [key]: prependPathEntry(base, o.paths.binDir, delimiter),
        [ENV_CLI]: o.paths.shimPath,
        [BRIDGE_ENV.file]: o.paths.bridgeFile,
      }
      return { ...spec, env }
    },
  }
}
