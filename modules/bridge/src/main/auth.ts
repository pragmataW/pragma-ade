import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { LOCALHOST_NAME, LOOPBACK_HOST, NULL_ORIGIN, TOKEN_BYTES } from '../constants'
import { BRIDGE_AUTH } from '../contract'

const SHA256 = 'sha256'
const BEARER_RE = new RegExp(`^${BRIDGE_AUTH.scheme}\\s+(\\S+)$`, 'i')

/** 32 random bytes, base64url (43 chars); regenerated per app start. */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

const digest = (s: string): Buffer => createHash(SHA256).update(s).digest()

/** Constant-time comparison over sha256 digests (length differences do not leak). */
export function tokensEqual(expected: string, given: string | null | undefined): boolean {
  if (!given) return false
  return timingSafeEqual(digest(expected), digest(given))
}

/** The token of an `Authorization: Bearer <token>` header (scheme case-insensitive), else null. */
export function bearerFrom(header: string | string[] | undefined): string | null {
  if (typeof header !== 'string') return null
  return BEARER_RE.exec(header.trim())?.[1] ?? null
}

/** DNS-rebinding guard: only `127.0.0.1:<port>` or `localhost:<port>`. */
export function isAllowedHost(host: string | undefined, port: number): boolean {
  if (!host) return false
  return host === `${LOOPBACK_HOST}:${port}` || host === `${LOCALHOST_NAME}:${port}`
}

/** Browsers always send an Origin; local tools send none (or `null`). */
export function isAllowedOrigin(origin: string | undefined): boolean {
  return origin === undefined || origin === NULL_ORIGIN
}
