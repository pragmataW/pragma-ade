import type { AgentProfile, AgentSession, LaunchContext, Resume } from '../../contract'
import { baseEnvAdditions } from './env'
import type { SessionTempDirs } from './session-temp'

export interface LaunchContextInput {
  session: Pick<AgentSession, 'id' | 'mode'>
  profile: AgentProfile
  worktree: { id: string; path: string }
  initialPrompt?: string
  resume?: Resume
}
export type LaunchContextFactory = (input: LaunchContextInput) => Promise<LaunchContext>

/** Builds the `LaunchContext` shared by the terminal handler and `buildLaunchEnv` (creates the session temp dir). */
export function createLaunchContextFactory(deps: {
  tempDirs: Pick<SessionTempDirs, 'create'>
  getShellEnv(): Promise<Record<string, string>>
}): LaunchContextFactory {
  return async ({ session, profile, worktree, initialPrompt, resume }) => {
    const temp = await deps.tempDirs.create(session.id)
    return {
      profile,
      worktreePath: worktree.path,
      worktreeId: worktree.id,
      sessionId: session.id,
      initialPrompt,
      resume,
      env: baseEnvAdditions(profile.env, { sessionId: session.id, worktreeId: worktree.id }),
      mode: session.mode,
      shellEnv: Object.freeze({ ...(await deps.getShellEnv()) }),
      tempDir: temp.dir,
      writeTempFile: temp.writeTempFile,
    }
  }
}
