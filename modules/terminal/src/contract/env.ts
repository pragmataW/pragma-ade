declare module '@pragma/sdk' {
  interface CapabilityMap {
    terminalEnv: TerminalEnvCapability
  }
}

export const TERMINAL_ENV_CAPABILITY = 'terminalEnv' as const

/**
 * How a provider keeps its CLI's own session stamps out of Pragma's ptys. When the app was started from a running
 * agent (e.g. `pnpm dev` inside a CLI session), its env carries that session's markers; a nested CLI started in a
 * Pragma terminal would mistake itself for that session's child. Every pty spawn removes these keys.
 */
export interface TerminalEnvCapability {
  /** Env keys inherited from a parent session that no pty may pass on. Never a `PRAGMA_` variable. */
  inheritedEnvKeys: readonly string[]
}
