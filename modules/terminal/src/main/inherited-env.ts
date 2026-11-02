import { TERMINAL_ENV_CAPABILITY, type TerminalEnvCapability } from '../contract'

/** Pragma's own variables are always passed on, whatever a provider lists. */
const PRAGMA_ENV_PREFIX = 'PRAGMA_'

/** The slice of `ctx.providers` this needs. */
export interface TerminalEnvProviders {
  providersWith(key: typeof TERMINAL_ENV_CAPABILITY): { id: string }[]
  capability(id: string, key: typeof TERMINAL_ENV_CAPABILITY): TerminalEnvCapability | undefined
}

/** The union of every provider's `terminalEnv.inheritedEnvKeys`. */
export function inheritedEnvKeys(providers: TerminalEnvProviders): string[] {
  const keys = new Set<string>()
  for (const { id } of providers.providersWith(TERMINAL_ENV_CAPABILITY))
    for (const key of providers.capability(id, TERMINAL_ENV_CAPABILITY)?.inheritedEnvKeys ?? []) keys.add(key)
  return [...keys]
}

/** `env` without `keys` (except `PRAGMA_` variables). */
export function scrubInheritedEnv(env: Record<string, string>, keys: readonly string[]): Record<string, string> {
  const drop = new Set(keys.filter((k) => !k.startsWith(PRAGMA_ENV_PREFIX)))
  return Object.fromEntries(Object.entries(env).filter(([k]) => !drop.has(k)))
}
