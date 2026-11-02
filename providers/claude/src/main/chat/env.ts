// MIT License — Copyright (c) 2026 Lovecast Inc. (stablyai/orca)
// Derived from orca src/main/claude/claude-child-process-environment.ts (child-session stamp stripping).
// Modified for Pragma ADE: no auth stripping (the user's own login is used); the env comes from 03's `buildLaunchEnv`.
import { withoutClaudeSessionStamps } from '../inherited-env'

/** The child env: everything from `buildLaunchEnv` (incl. the user's auth env) minus a parent Claude's stamps. */
export function buildClaudeChildEnv(env: Record<string, string>): Record<string, string> {
  return withoutClaudeSessionStamps(env)
}
