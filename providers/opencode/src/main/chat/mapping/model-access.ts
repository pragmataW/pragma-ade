import { LOOPBACK_HOSTS, PROVIDER_ACTIVATION } from '../constants'
import type { IntegrationInfo, ProviderInfo } from '../schemas'

/** What the model picker knows about one usable provider. */
export interface ProviderState {
  name: string
  /** A local server (e.g. Ollama): small context windows may not fit OpenCode's system prompt. */
  local: boolean
  /** The saved credential was rejected in this server's lifetime (reconnect in the provider settings). */
  reauth: boolean
}

/** Usable providers by id; null = unknown (an older server): every enabled model is offered. */
export type ProviderAccess = ReadonlyMap<string, ProviderState> | null

export function isLoopbackUrl(url: string | undefined): boolean {
  if (!url) return false
  try {
    return (LOOPBACK_HOSTS as readonly string[]).includes(new URL(url).hostname)
  } catch {
    return false
  }
}

/**
 * OpenCode reports every catalog model as enabled, even without (or with broken) credentials, so the picker offers
 * only providers that can answer: a saved connection (credential or env), a key in the provider config (`public` for
 * OpenCode's free models) or no integration at all (config-only, e.g. a local Ollama). Disabled providers are hidden.
 */
export function providerAccess(
  providers: readonly ProviderInfo[],
  integrations: readonly IntegrationInfo[],
  authFailed: ReadonlySet<string>,
): ProviderAccess {
  const connected = new Set(integrations.filter((i) => i.connections.length > 0).map((i) => i.id))
  const usable = providers.filter(
    (p) =>
      p.activation !== PROVIDER_ACTIVATION.disabled &&
      (!p.integrationID || connected.has(p.integrationID) || Boolean(p.settings?.apiKey)),
  )
  return new Map(
    usable.map((p) => [
      p.id,
      { name: p.name, local: isLoopbackUrl(p.settings?.baseURL), reauth: authFailed.has(p.id) },
    ]),
  )
}
