import { z } from '@pragma/sdk'
import { BRIDGE_INFO_SOURCES, BRIDGE_PATHS, BRIDGE_PROTOCOL_VERSION, MIN_TOKEN_LENGTH } from './constants'

/** `<userData>/bridge.json` (mode 0600), written by the running app. */
export const BridgeInfoFileSchema = z.object({
  version: z.literal(BRIDGE_PROTOCOL_VERSION),
  url: z.string().url(),
  wsUrl: z.string(),
  token: z.string().min(MIN_TOKEN_LENGTH),
  pid: z.number().int(),
  startedAt: z.string(),
})
export type BridgeInfoFile = z.infer<typeof BridgeInfoFileSchema>

/** How a client found the bridge. */
export const BridgeInfoSchema = z.object({
  url: z.string().url(),
  token: z.string(),
  wsUrl: z.string(),
  source: z.enum(BRIDGE_INFO_SOURCES),
})
export type BridgeInfo = z.infer<typeof BridgeInfoSchema>

const HTTP_SCHEME_RE = /^http(s?):/

/** `http://h:p` → `ws://h:p/ws`. */
export function wsUrlFor(httpUrl: string): string {
  const base = httpUrl.replace(/\/+$/, '').replace(HTTP_SCHEME_RE, 'ws$1:')
  return `${base}${BRIDGE_PATHS.ws}`
}
