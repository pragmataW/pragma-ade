import type { AgentProfile, AgentSessionsService } from '@pragma/module-agents/contract'
import { CLI_ERROR } from '../contract'
import { CliError } from './cli-error'
import { toCliProfile } from './mappers'

/** A profile's user-facing name (built-ins have `name: null` and a translated `displayNameKey`). */
export type ProfileNamer = (p: AgentProfile) => string

const LIST_JOIN = ', '

/** Exact id, else a case-insensitive exact name; refuses disabled and ambiguous matches. */
export async function resolveProfile(
  agents: AgentSessionsService,
  ref: string,
  nameOf: ProfileNamer,
): Promise<AgentProfile> {
  const profiles = await agents.listProfiles()
  const byId = profiles.find((p) => p.id === ref)
  const wanted = ref.trim().toLowerCase()
  const matches = byId ? [byId] : profiles.filter((p) => nameOf(p).toLowerCase() === wanted)
  if (matches.length > 1)
    throw new CliError(CLI_ERROR.ambiguous, `More than one profile is named '${ref}'; pass its id.`, {
      candidates: matches.map((p) => toCliProfile(p, nameOf(p))),
    })
  const [match] = matches
  if (match && !match.enabled) throw new CliError(CLI_ERROR.invalid_argument, `Profile '${nameOf(match)}' is disabled.`)
  if (match) return match
  const enabled = profiles.filter((p) => p.enabled).map(nameOf)
  throw new CliError(CLI_ERROR.not_found, `No profile '${ref}'. Enabled profiles: ${enabled.join(LIST_JOIN)}.`)
}
