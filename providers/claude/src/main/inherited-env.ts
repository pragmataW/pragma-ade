// MIT License — Copyright (c) 2026 Lovecast Inc. (stablyai/orca)
// Derived from orca src/main/claude/claude-child-process-environment.ts (child-session stamp stripping).
// Modified for Pragma ADE: one list shared by the chat child env and the `terminalEnv` capability.
import { CLAUDE_INHERITED_ENV } from '../constants'

const STAMPS = new Set<string>(CLAUDE_INHERITED_ENV)

/** `env` minus a parent Claude Code session's stamps (`CLAUDE_INHERITED_ENV`). */
export function withoutClaudeSessionStamps(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(env).filter(([k]) => !STAMPS.has(k)))
}
