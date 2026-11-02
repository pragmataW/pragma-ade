import { existsSync } from 'node:fs'
import { BRIDGE_ENV, type BridgeConnection, BridgeUnavailableError, readBridgeInfo } from '@pragma/module-bridge/client'
import { NO_BRIDGE_INFO, NOT_RUNNING_HINTS } from './constants'

/** Where the running app's bridge listens. */
export type BridgeEndpoint = BridgeConnection

/** The app cannot be reached (no info, stale info, closed port, rejected token): exit code 3. */
export class NotRunningError extends Error {
  readonly hint: string | undefined
  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'NotRunningError'
    this.hint = hint
  }
}

/** Discovery order and file format belong to `readBridgeInfo` (§10.3); this only maps its failures. */
export async function resolveBridgeEndpoint(
  env: NodeJS.ProcessEnv,
  opts: { home?: string; platform?: NodeJS.Platform } = {},
): Promise<BridgeEndpoint> {
  const file = env[BRIDGE_ENV.file]
  const hasEnvPair = Boolean(env[BRIDGE_ENV.url] && env[BRIDGE_ENV.token])
  if (!hasEnvPair && file && !existsSync(file))
    throw new NotRunningError(NO_BRIDGE_INFO, NOT_RUNNING_HINTS.missingFile(file))
  try {
    const { url, token } = await readBridgeInfo({ env, home: opts.home, platform: opts.platform })
    return { url, token }
  } catch (e) {
    if (!(e instanceof BridgeUnavailableError)) throw e
    const invalid = file !== undefined && e.message.includes(file)
    throw new NotRunningError(NO_BRIDGE_INFO, invalid ? e.message : undefined)
  }
}
