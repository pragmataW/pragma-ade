import { AGENT_ENV } from '../../contract'

/** Profile env plus the session/worktree ids (the ids win). */
export function baseEnvAdditions(
  profileEnv: Record<string, string>,
  ids: { sessionId: string; worktreeId: string },
): Record<string, string> {
  return { ...profileEnv, [AGENT_ENV.sessionId]: ids.sessionId, [AGENT_ENV.worktreeId]: ids.worktreeId }
}

/** The full process env: login-shell env with the launch additions over it. */
export function mergeEnv(
  shellEnv: Readonly<Record<string, string>>,
  additions: Record<string, string>,
): Record<string, string> {
  return { ...shellEnv, ...additions }
}
