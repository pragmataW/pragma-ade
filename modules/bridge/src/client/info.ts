import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { APP_NAME, defaultUserDataDirs, USER_DATA_ENV } from '@pragma/sdk'
import { BRIDGE_ENV, BRIDGE_INFO_FILE, BRIDGE_UNAVAILABLE } from '../contract/constants'
import { type BridgeInfo, BridgeInfoFileSchema, wsUrlFor } from '../contract/info'
import { BridgeUnavailableError } from './errors'

const ENOENT = 'ENOENT'
const SOURCE = { env: 'env', file: 'file' } as const

export interface ReadBridgeInfoOptions {
  env?: Record<string, string | undefined>
  userDataDirs?: readonly string[]
  platform?: string
  home?: string
}

/** A parsed info file; null when it does not exist; throws `no_config` when it is invalid. */
async function tryReadInfoFile(path: string): Promise<BridgeInfo | null> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === ENOENT) return null
    throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.no_config, `cannot read bridge info file ${path}`)
  }
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    raw = undefined
  }
  const parsed = BridgeInfoFileSchema.safeParse(raw)
  if (!parsed.success)
    throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.no_config, `invalid bridge info file ${path}`)
  const { url, wsUrl, token } = parsed.data
  return { url, wsUrl, token, source: SOURCE.file }
}

/** Reads one info file; a missing file is `no_config` too. */
export async function readBridgeInfoFile(path: string): Promise<BridgeInfo> {
  const info = await tryReadInfoFile(path)
  if (!info) throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.no_config, `no bridge info file at ${path}`)
  return info
}

function candidateFiles(opts: ReadBridgeInfoOptions, env: Record<string, string | undefined>): string[] {
  const dirs =
    opts.userDataDirs ??
    defaultUserDataDirs({
      platform: opts.platform ?? process.platform,
      home: opts.home ?? homedir(),
      env,
      appName: APP_NAME,
    })
  const files = [env[BRIDGE_ENV.file], env[USER_DATA_ENV] && join(env[USER_DATA_ENV], BRIDGE_INFO_FILE)]
  for (const dir of dirs) files.push(join(dir, BRIDGE_INFO_FILE))
  return [...new Set(files.filter((f): f is string => Boolean(f)))]
}

/** §10.3: env URL+TOKEN → `PRAGMA_BRIDGE_FILE` → `$PRAGMA_USER_DATA/bridge.json` → default userData dirs. */
export async function readBridgeInfo(opts: ReadBridgeInfoOptions = {}): Promise<BridgeInfo> {
  const env = opts.env ?? process.env
  const url = env[BRIDGE_ENV.url]
  const token = env[BRIDGE_ENV.token]
  if (url && token) return { url, token, wsUrl: wsUrlFor(url), source: SOURCE.env }
  for (const file of candidateFiles(opts, env)) {
    const info = await tryReadInfoFile(file)
    if (info) return info
  }
  throw new BridgeUnavailableError(BRIDGE_UNAVAILABLE.no_config, 'no bridge configuration found')
}
