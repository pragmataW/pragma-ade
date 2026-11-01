import type { AgentProfile } from '@pragma/module-agents/contract'

const KEY_SEPARATOR = '\u0000'

export interface SupportFailure {
  reasonKey: string
  detail?: string
}

/** Startup failures per profile command line; editing the profile (command or args) clears it. */
export class SupportCache {
  readonly #failures = new Map<string, SupportFailure>()

  static key(profile: Pick<AgentProfile, 'id' | 'command' | 'args'>): string {
    return [profile.id, profile.command, JSON.stringify(profile.args)].join(KEY_SEPARATOR)
  }

  fail(profile: Pick<AgentProfile, 'id' | 'command' | 'args'>, reasonKey: string, detail?: string): void {
    this.#failures.set(SupportCache.key(profile), detail === undefined ? { reasonKey } : { reasonKey, detail })
  }

  get(profile: Pick<AgentProfile, 'id' | 'command' | 'args'>): SupportFailure | undefined {
    return this.#failures.get(SupportCache.key(profile))
  }

  clear(profile: Pick<AgentProfile, 'id' | 'command' | 'args'>): void {
    this.#failures.delete(SupportCache.key(profile))
  }
}
