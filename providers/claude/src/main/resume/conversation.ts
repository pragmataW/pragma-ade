import { readdir, realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type ConversationQuery, isSafeExternalSessionId } from '@pragma/module-chat-switch/contract'

const CONFIG_DIR_ENV = 'CLAUDE_CONFIG_DIR'
const HOME_ENV = 'HOME'
const DEFAULT_CONFIG_DIR = '.claude'
const PROJECTS_DIR = 'projects'
const TRANSCRIPT_EXT = '.jsonl'
/** Claude Code names a project dir after the cwd with every non-alphanumeric character replaced by `-`. */
const PROJECT_DIR_CHAR_RE = /[^a-zA-Z0-9]/g
const PROJECT_DIR_REPLACEMENT = '-'

/** The config root the CLI uses for this env: `$CLAUDE_CONFIG_DIR`, else `$HOME/.claude`. */
export const claudeConfigDir = (env: Record<string, string | undefined>): string =>
  env[CONFIG_DIR_ENV] || join(env[HOME_ENV] || homedir(), DEFAULT_CONFIG_DIR)

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
 * Whether `claude --resume <id>` finds a conversation: the CLI writes `<config>/projects/<cwd>/<id>.jsonl` only once
 * the first message was sent (claude 2.1.316; a fresh TUI or chat has no file and `--resume` exits with "No
 * conversation found with session ID"). The worktree's own project dir (as given and resolved) is checked first, then
 * every project dir (very long cwds get a shortened dir name).
 */
export async function hasClaudeConversation(q: ConversationQuery): Promise<boolean> {
  if (!isSafeExternalSessionId(q.externalSessionId)) return false
  const projects = join(claudeConfigDir(q.env), PROJECTS_DIR)
  const file = `${q.externalSessionId}${TRANSCRIPT_EXT}`
  const resolved = await realpath(q.worktreePath).catch(() => q.worktreePath)
  const own = [...new Set([q.worktreePath, resolved])].map(claudeProjectDirName)
  for (const dir of own) if (await isTranscript(join(projects, dir, file))) return true
  for (const dir of await listDirs(projects))
    if (!own.includes(dir) && (await isTranscript(join(projects, dir, file)))) return true
  return false
}
