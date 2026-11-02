import type { AgentSession } from '@pragma/module-agents/contract'
import { CLI_METHOD } from '../../contract'
import { type CliHandler, defineCliHandler } from '../lib/define-cli-handler'
import { toCliProfile, toCliSession } from '../mappers'
import { resolveWorktree } from '../resolve-context'
import { resolveProfile } from '../resolve-profile'
import type { CliHandlerDeps } from './types'

type AgentMethod = 'agentList' | 'agentSpawn' | 'profileList'

export function agentHandlers({ projects, agents, nameOf }: CliHandlerDeps): Record<AgentMethod, CliHandler> {
  const namesById = async (): Promise<Map<string, string>> =>
    new Map((await agents.listProfiles()).map((p) => [p.id, nameOf(p)]))
  const withName = (s: AgentSession, names: Map<string, string>) =>
    toCliSession(s, s.profileId ? (names.get(s.profileId) ?? null) : null)
  return {
    agentList: defineCliHandler(CLI_METHOD.agentList, async (req) => {
      const worktree = await resolveWorktree(projects, req.worktreeId, req.context)
      const [sessions, names] = await Promise.all([agents.listSessions(worktree.id), namesById()])
      return { worktreeId: worktree.id, sessions: sessions.map((s) => withName(s, names)) }
    }),
    agentSpawn: defineCliHandler(CLI_METHOD.agentSpawn, async (req) => {
      const worktree = await resolveWorktree(projects, req.worktreeId, req.context)
      const profile = await resolveProfile(agents, req.profile, nameOf)
      const input = {
        worktreeId: worktree.id,
        profileId: profile.id,
        ...(req.prompt ? { initialPrompt: req.prompt } : {}),
      }
      return toCliSession(await agents.startSession(input), nameOf(profile))
    }),
    profileList: defineCliHandler(CLI_METHOD.profileList, async () => {
      const profiles = await agents.listProfiles()
      return { profiles: profiles.map((p) => toCliProfile(p, nameOf(p))) }
    }),
  }
}
