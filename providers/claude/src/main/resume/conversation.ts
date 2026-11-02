import { readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ConversationQuery, isSafeExternalSessionId } from '@pragma/module-chat-switch/contract'

const CONFIG_DIR_ENV = 'CLAUDE_CONFIG_DIR'
export const CLAUDE_HOME_ENV = 'HOME'
const DEFAULT_CONFIG_DIR = '.claude'
const PROJECTS_DIR = 'projects'
export const CLAUDE_TRANSCRIPT_EXT = '.jsonl'
/** Claude Code names a project dir after the cwd with every non-alphanumeric character replaced by `-`. */
const PROJECT_DIR_CHAR_RE = /[^a-zA-Z0-9]/g
const PROJECT_DIR_REPLACEMENT = '-'

/** The config root the CLI uses for this env: `$CLAUDE_CONFIG_DIR`, else `$HOME/.claude`. */
export const claudeConfigDir = (env: Record<string, string | undefined>): string =>
  env[CONFIG_DIR_ENV] || join(env[CLAUDE_HOME_ENV] || homedir(), DEFAULT_CONFIG_DIR)

export const claudeProjectDirName = (cwd: string): string => cwd.replace(PROJECT_DIR_CHAR_RE, PROJECT_DIR_REPLACEMENT)

/** A non-empty transcript file (only `stat`; the content is never read). */
async function isTranscript(path: string): Promise<boolean> {
  try {
    const s = await stat(path)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

async function listDirs(path: string): Promise<string[]> {
  try {
    return (await readdir(path, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)
  } catch {
    return []
  }
}

/**
 * The CLI writes `<config>/projects/<cwd>/<id>.jsonl` only once the first message was sent (claude 2.1.316). The
 * session's own project dir (as given and resolved) is checked first, then every project dir (very long cwds get a
 * shortened dir name). Returns the transcript path, or `null`.
 */
export async function findClaudeTranscript(
  configDir: string,
  sessionId: string,
  cwd: string | undefined,
): Promise<string | null> {
  if (!isSafeExternalSessionId(sessionId)) return null
  const projects = join(configDir, PROJECTS_DIR)
  const file = `${sessionId}${CLAUDE_TRANSCRIPT_EXT}`
  const resolved = cwd ? await realpath(cwd).catch(() => cwd) : undefined
  const own = [...new Set([cwd, resolved])].filter((d) => d !== undefined).map(claudeProjectDirName)
  const dirs = [...own, ...(await listDirs(projects)).filter((d) => !own.includes(d))]
  for (const dir of dirs) {
    const path = join(projects, dir, file)
    if (await isTranscript(path)) return path
  }
  return null
}

/** Whether `claude --resume <id>` finds a conversation (a fresh TUI or chat has no transcript yet). */
export async function hasClaudeConversation(q: ConversationQuery): Promise<boolean> {
  return (await findClaudeTranscript(claudeConfigDir(q.env), q.externalSessionId, q.worktreePath)) !== null
}
