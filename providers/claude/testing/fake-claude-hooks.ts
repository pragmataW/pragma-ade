import { join } from 'node:path'

/** Absolute path of the fake Claude (executable script). */
export const fakeClaudeHooksPath = join(import.meta.dirname, 'fake-claude-hooks', 'index.mjs')
/** Env var that sets the fake's Claude session id (11c sets its own ids, review item 17). */
export const FAKE_CLAUDE_SESSION_ENV = 'FAKE_CLAUDE_SESSION_ID'
export const FAKE_CLAUDE_DEFAULT_SESSION = 'fake-claude-session'
