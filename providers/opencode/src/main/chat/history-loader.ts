import {
  type ChatEvent,
  type ChatHistoryContext,
  DEFAULT_STARTUP_TIMEOUT_MS,
  EVENT_KIND as K,
} from '@pragma/module-chat/contract'
import { HISTORY_PAGE, ORDER } from './constants'
import { historyToEvents } from './mapping/history'
import { contextWindowOf } from './mapping/options'
import { type Message, messagePageSchema } from './schemas'
import type { ConnectionPool, OpencodeConnection } from './server/connection'

/** Every message of a session, oldest first, following `cursor.next`. */
export async function listAllMessages(conn: OpencodeConnection, sessionID: string): Promise<Message[]> {
  const all: Message[] = []
  let cursor: string | undefined
  do {
    const raw = await conn.client.message.list({ sessionID, order: ORDER.asc, limit: HISTORY_PAGE, cursor })
    const page = messagePageSchema.parse(raw)
    all.push(...page.data)
    cursor = page.cursor?.next ?? undefined
  } while (cursor)
  return all
}

/**
 * `loadHistory`: the transcript straight from OpenCode's database through a pooled server. 11a passes no env for
 * history, so the login-shell env (+ profile env) is used; the lease is released at once (the idle grace keeps the
 * server warm for a resume).
 */
export function loadOpencodeHistory(pool: ConnectionPool, getShellEnv: () => Promise<Record<string, string>>) {
  return async (ctx: ChatHistoryContext): Promise<ChatEvent[]> => {
    const env = Object.keys(ctx.env).length ? ctx.env : { ...(await getShellEnv()), ...ctx.profile.env }
    const lease = await pool.acquire({
      profile: ctx.profile,
      worktreePath: ctx.worktreePath,
      env,
      startupTimeoutMs: DEFAULT_STARTUP_TIMEOUT_MS,
    })
    try {
      const conn = lease.resource
      const [messages, models] = await Promise.all([
        listAllMessages(conn, ctx.externalSessionId),
        conn.models().catch(() => []),
      ])
      const events = historyToEvents(messages, (ref) => contextWindowOf(models, ref))
      return [{ kind: K.sessionInfo, externalSessionId: ctx.externalSessionId }, ...events]
    } finally {
      lease.release()
    }
  }
}
