import { STRIPPED_ENV } from './constants'

const STRIPPED = new Set<string>(STRIPPED_ENV)

/** The child env: everything from `buildLaunchEnv` (incl. the user's auth env) minus a parent Claude's stamps. */
export function buildClaudeChildEnv(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !STRIPPED.has(k)))
}
