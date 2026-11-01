import { type AgentProfile, type AgentSession, formatCommandLine } from '../contract'

export interface CommandPreview {
  /** Built-ins: the provider's stock command line. */
  stock: string | null
  effective: string
  /** A built-in whose command or arguments are overridden. */
  customized: boolean
}

export function commandPreview(p: AgentProfile): CommandPreview {
  const stock = p.isBuiltin && p.stockCommand !== null ? formatCommandLine(p.stockCommand, p.stockArgs ?? []) : null
  const customized = p.isBuiltin && (p.commandOverride !== null || p.argsOverride !== null)
  return { stock, effective: formatCommandLine(p.command, p.args), customized }
}

/** The name shown for a profile: its own name, else the provider's display name. */
export function profileName(p: AgentProfile | undefined, t: (key: string) => string): string {
  if (!p) return ''
  if (p.name) return p.name
  return p.displayNameKey ? t(p.displayNameKey) : p.id
}

/** Enabled profiles of available providers, the default first. */
export function launchableProfiles(profiles: readonly AgentProfile[]): AgentProfile[] {
  const ok = profiles.filter((p) => p.enabled && p.available)
  return [...ok.filter((p) => p.isDefault), ...ok.filter((p) => !p.isDefault)]
}

/** After removing a tab: its right neighbour, else the left one, else null. */
export function nextActiveTab(sessions: readonly AgentSession[], removedId: string): string | null {
  const i = sessions.findIndex((s) => s.id === removedId)
  if (i < 0) return sessions.at(-1)?.id ?? null
  return sessions[i + 1]?.id ?? sessions[i - 1]?.id ?? null
}

/** The tab selected when a worktree's sessions load: highest `lastFocusedAt`, else the last one. */
export function initialActiveTab(sessions: readonly AgentSession[]): string | null {
  const focused = sessions.filter((s) => s.lastFocusedAt !== null)
  focused.sort((a, b) => (b.lastFocusedAt ?? 0) - (a.lastFocusedAt ?? 0))
  return focused[0]?.id ?? sessions.at(-1)?.id ?? null
}
