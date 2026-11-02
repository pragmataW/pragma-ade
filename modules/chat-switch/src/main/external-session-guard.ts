import type { ClaimResult, ExternalSessionGuard, ExternalSessionKey } from '../contract'

const keyOf = (k: ExternalSessionKey): string => JSON.stringify([k.providerId, k.externalSessionId])

/** In-memory guard: key → owner and owner → key, so a session holds at most one external id. */
export function createExternalSessionGuard(): ExternalSessionGuard {
  const owners = new Map<string, string>()
  const keys = new Map<string, string>()
  const release = (sessionId: string) => {
    const k = keys.get(sessionId)
    if (k === undefined) return
    keys.delete(sessionId)
    if (owners.get(k) === sessionId) owners.delete(k)
  }
  return {
    claim(k, sessionId): ClaimResult {
      const key = keyOf(k)
      const owner = owners.get(key)
      if (owner !== undefined && owner !== sessionId) return { ok: false, ownerSessionId: owner }
      if (keys.get(sessionId) !== key) release(sessionId)
      owners.set(key, sessionId)
      keys.set(sessionId, key)
      return { ok: true }
    },
    release,
    ownerOf: (k) => owners.get(keyOf(k)),
  }
}
