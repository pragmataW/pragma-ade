import { join } from 'node:path'
import { BRIDGE_INFO_FILE } from '@pragma/module-bridge/contract'
import { BIN_DIR_NAME, RESOURCE_PATHS, WIN32 } from '../constants'
import { CLI_BIN_NAME, CLI_CMD_SHIM_NAME, ENV_CLI_BUNDLE } from '../contract'

export interface CliPaths {
  bundlePath: string
  skillsDir: string
  /** Generated shim dir, prepended to every agent's PATH. */
  binDir: string
  shimPath: string
  bridgeFile: string
  /** Electron binary; the shim runs it with `ELECTRON_RUN_AS_NODE=1`. */
  execPath: string
}

export function resolveCliPaths(o: {
  /** `(rel) => ctx.paths.resource('cli-integration', rel)`: same rel path in dev and packaged. */
  resource: (rel: string) => string
  /** `ctx.module.paths.data`. */
  dataDir: string
  userData: string
  execPath: string
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
}): CliPaths {
  const binDir = join(o.dataDir, BIN_DIR_NAME)
  return {
    bundlePath: o.env[ENV_CLI_BUNDLE] || o.resource(RESOURCE_PATHS.bundle),
    skillsDir: o.resource(RESOURCE_PATHS.skills),
    binDir,
    shimPath: join(binDir, o.platform === WIN32 ? CLI_CMD_SHIM_NAME : CLI_BIN_NAME),
    bridgeFile: join(o.userData, BRIDGE_INFO_FILE),
    execPath: o.execPath,
  }
}
