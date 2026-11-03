import type { AgentSessionsService } from '@pragma/module-agents/contract'
import type { ProjectsService } from '@pragma/module-projects/contract'
import type { Logger } from '@pragma/sdk'
import {
  CLI_ERROR,
  type CliCallerContext,
  type CliSessionLocateResult,
  type CliTranscript,
  type SessionTranscriptCapability,
} from '../contract'
import { CliError } from './cli-error'

/** A provider that implements `sessionTranscript`. */
export interface TranscriptProvider {
  id: string
  transcript: SessionTranscriptCapability
}

export interface TranscriptLocator {
  /** Read on every call (providers can be enabled or disabled while the app runs). */
  providers(): TranscriptProvider[]
  home: string
  env: Readonly<Record<string, string | undefined>>
  log: Logger
}

export interface TranscriptQuery {
  providerSessionId: string
  /** Ask only this provider (the session record names it). */
  providerId?: string
  cwd?: string
  /** The session profile's env over the app's (a profile may point the CLI at its own data dir). */
  env?: Readonly<Record<string, string>>
}

const NO_SESSION_ID =
  'No session id given and PRAGMA_SESSION_ID is not set; pass a session id (Pragma, Claude or OpenCode).'

/** Every provider's location for this id (a provider that fails or does not know it is skipped). */
export async function findTranscripts(locator: TranscriptLocator, q: TranscriptQuery): Promise<CliTranscript[]> {
  const providers = locator.providers().filter((p) => q.providerId === undefined || p.id === q.providerId)
  const found = await Promise.all(
    providers.map(async (p) => {
      try {
        const env = q.env ? { ...locator.env, ...q.env } : locator.env
        const query = { sessionId: q.providerSessionId, home: locator.home, env }
        const location = await p.transcript.locateTranscript(q.cwd ? { ...query, cwd: q.cwd } : query)
        return location ? [{ ...location, providerId: p.id, providerSessionId: q.providerSessionId }] : []
      } catch (e) {
        locator.log.warn(`cli-integration: ${p.id} could not locate session ${q.providerSessionId}`, e)
        return []
      }
    }),
  )
  return found.flat()
}

export interface SessionLookupDeps {
  agents: AgentSessionsService
  projects: ProjectsService
  locator: TranscriptLocator
}

/** A Pragma session → the provider and cwd to ask; `null` when Pragma does not know the id. */
async function pragmaQuery(deps: SessionLookupDeps, id: string): Promise<TranscriptQuery | null> {
  const session = await deps.agents.getSession(id)
  if (!session) return null
  if (!session.externalSessionId)
    throw new CliError(CLI_ERROR.not_found, `Session '${id}' has not reported a provider session id yet.`)
  const [worktree, profile] = await Promise.all([
    deps.projects.getWorktree(session.worktreeId).catch(() => null),
    session.profileId ? deps.agents.getProfile(session.profileId).catch(() => null) : null,
  ])
  return {
    providerSessionId: session.externalSessionId,
    providerId: session.providerId,
    ...(worktree ? { cwd: worktree.path } : {}),
    ...(profile && Object.keys(profile.env).length > 0 ? { env: profile.env } : {}),
  }
}

/** The transcripts of a Pragma session (best effort, for the handoff prompt): never throws. */
export async function transcriptsOfPragmaSession(deps: SessionLookupDeps, id: string): Promise<CliTranscript[]> {
  try {
    const q = await pragmaQuery(deps, id)
    return q ? await findTranscripts(deps.locator, q) : []
  } catch (e) {
    deps.locator.log.warn(`cli-integration: no transcript for session ${id}`, e)
    return []
  }
}

const locationKey = (t: CliTranscript): string => JSON.stringify([t.providerId, t.path])

/**
 * A provider session id Pragma does not know: every provider with the app env, and each provider again with every
 * distinct env of its profiles (a profile may keep its CLI data in its own dir); one entry per location.
 */
async function findTranscriptsAnywhere(deps: SessionLookupDeps, base: TranscriptQuery): Promise<CliTranscript[]> {
  const profiles = await deps.agents.listProfiles().catch(() => [])
  const variants = new Map<string, TranscriptQuery>()
  for (const p of profiles) {
    if (Object.keys(p.env).length === 0) continue
    const q = { ...base, providerId: p.providerId, env: p.env }
    variants.set(JSON.stringify([q.providerId, q.env]), q)
  }
  const found = await Promise.all([base, ...variants.values()].map((q) => findTranscripts(deps.locator, q)))
  return [...new Map(found.flat().map((t) => [locationKey(t), t])).values()]
}

/** `pragma session locate [<id>]`: a Pragma session id, else a provider session id searched in every provider. */
export async function locateSession(
  deps: SessionLookupDeps,
  sessionId: string | undefined,
  context: CliCallerContext,
): Promise<CliSessionLocateResult> {
  const id = sessionId ?? context.sessionId
  if (!id) throw new CliError(CLI_ERROR.invalid_argument, NO_SESSION_ID)
  const fromPragma = await pragmaQuery(deps, id)
  const transcripts = fromPragma
    ? await findTranscripts(deps.locator, fromPragma)
    : await findTranscriptsAnywhere(deps, { providerSessionId: id, cwd: context.cwd })
  if (transcripts.length === 0)
    throw new CliError(CLI_ERROR.not_found, `No local transcript found for session '${id}'.`)
  return { pragmaSessionId: fromPragma ? id : null, transcripts }
}
