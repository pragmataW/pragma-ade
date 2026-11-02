import { stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { isSafeExternalSessionId } from '@pragma/module-chat-switch/contract'
import type {
  SessionTranscriptCapability,
  SessionTranscriptLocation,
  SessionTranscriptQuery,
} from '@pragma/module-cli-integration/contract'
import { defineCapability } from '@pragma/sdk'
import { DEFAULT_COMMAND, PROVIDER_ID } from '../constants'
import { OPENCODE_SESSION_PREFIX } from './resume.capability'

const ENV = { db: 'OPENCODE_DB', xdgData: 'XDG_DATA_HOME' } as const
const DEFAULT_DATA_DIR = ['.local', 'share'] as const
const APP_DIR = 'opencode'
const DB_FILE = 'opencode.db'
const FORMAT = 'OpenCode SQLite database (run readCommand for a JSON transcript)'
/** opencode v2.2.5: `session_v2` is current, `session` holds pre-v2 rows; both have `id` and `directory`. */
const SESSION_TABLES = ['session_v2', 'session'] as const
const exportCommand = (id: string): string => `${DEFAULT_COMMAND} session export ${id}`

/** opencode v2.2.5 keeps sessions in `$OPENCODE_DB`, else `${XDG_DATA_HOME:-~/.local/share}/opencode/opencode.db`. */
export function opencodeDbPath(home: string, env: Readonly<Record<string, string | undefined>>): string {
  const explicit = env[ENV.db]
  if (explicit && isAbsolute(explicit)) return explicit
  return join(env[ENV.xdgData] || join(home, ...DEFAULT_DATA_DIR), APP_DIR, DB_FILE)
}

interface SessionRow {
  directory: string | null
}

/** Reads the session row read-only; `undefined` when `node:sqlite` is unavailable (the id cannot be verified). */
async function readSession(dbPath: string, id: string): Promise<SessionRow | null | undefined> {
  const sqlite = await import('node:sqlite').catch(() => null)
  if (!sqlite) return undefined
  const db = new sqlite.DatabaseSync(dbPath, { readOnly: true })
  try {
    for (const table of SESSION_TABLES) {
      const row = selectDirectory(db, table, id)
      if (row) return row
    }
    return null
  } finally {
    db.close()
  }
}

function selectDirectory(db: import('node:sqlite').DatabaseSync, table: string, id: string): SessionRow | null {
  try {
    const row = db.prepare(`SELECT directory FROM ${table} WHERE id = ?`).get(id) as { directory?: unknown } | undefined
    if (!row) return null
    return { directory: typeof row.directory === 'string' ? row.directory : null }
  } catch {
    return null
  }
}

const isFile = (p: string): Promise<boolean> =>
  stat(p).then(
    (s) => s.isFile(),
    () => false,
  )

export async function locateOpencodeTranscript(q: SessionTranscriptQuery): Promise<SessionTranscriptLocation | null> {
  if (!isSafeExternalSessionId(q.sessionId) || !q.sessionId.startsWith(OPENCODE_SESSION_PREFIX)) return null
  const path = opencodeDbPath(q.home, q.env)
  if (!(await isFile(path))) return null
  const row = await readSession(path, q.sessionId).catch(() => null)
  if (row === null) return null
  return { path, format: FORMAT, cwd: row?.directory ?? null, readCommand: exportCommand(q.sessionId), extraPaths: [] }
}

/** OpenCode 2.x stores sessions in one SQLite database; `opencode session export <id>` prints the transcript. */
export const opencodeSessionTranscriptCapability: SessionTranscriptCapability = {
  locateTranscript: locateOpencodeTranscript,
}

export default defineCapability(PROVIDER_ID, 'sessionTranscript', opencodeSessionTranscriptCapability)
