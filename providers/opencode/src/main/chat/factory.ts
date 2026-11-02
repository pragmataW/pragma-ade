import {
  type ChatCapability,
  type ChatSessionContext,
  EVENT_KIND,
  type RetainServerQuery,
} from '@pragma/module-chat/contract'
import type { CapabilityContext } from '@pragma/sdk'
import { OPENCODE_PLUGIN_RESOURCE } from '../status/constants'
import { loadOpencodeHistory } from './history-loader'
import { createConnectionPool } from './server/connection'
import { OpencodeChatSession } from './session'
import { checkOpencodeSupport } from './support'

export type OpencodeChatCapability = ChatCapability & { dispose(): Promise<void> }

const hosts = (q: RetainServerQuery) => (s: OpencodeChatSession, ctx: ChatSessionContext) =>
  s.externalSessionId === q.externalSessionId && ctx.worktreePath === q.worktreePath && ctx.profile.id === q.profile.id

/** `chat` capability (factory form, §10.2): one connection pool; `dispose` closes live sessions and stops every server. */
export function createOpencodeChat(
  capCtx: Pick<CapabilityContext, 'log' | 'getShellEnv' | 'resolveCommand' | 'paths'>,
  o: { idleGraceMs?: number } = {},
): OpencodeChatCapability {
  const statusPluginDir = capCtx.paths.resource(OPENCODE_PLUGIN_RESOURCE)
  const pool = createConnectionPool({ log: capCtx.log, idleGraceMs: o.idleGraceMs, statusPluginDir })
  /** Live sessions with the context they acquired their server with (11c re-acquires the same key). */
  const live = new Map<OpencodeChatSession, ChatSessionContext>()
  return {
    checkSupport: (profile) => checkOpencodeSupport(profile, capCtx),
    async createSession(ctx) {
      let session: OpencodeChatSession | undefined
      const emit: typeof ctx.emit = (e) => {
        if (e.kind === EVENT_KIND.sessionExit && session) live.delete(session)
        ctx.emit(e)
      }
      capCtx.log.info(`opencode chat ${ctx.sessionId}: starting in ${ctx.worktreePath}`)
      session = await OpencodeChatSession.start({ ...ctx, emit }, pool, capCtx.log)
      live.set(session, ctx)
      return session
    },
    loadHistory: loadOpencodeHistory(pool, () => capCtx.getShellEnv()),
    /** 11c: one more lease on the serve hosting the session, so a `--server` TUI outlives the chat handle. */
    async retainServer(q) {
      const match = [...live].find(([s, ctx]) => hosts(q)(s, ctx))
      if (!match) return undefined
      const lease = await pool.acquire(match[1])
      capCtx.log.info(`opencode chat: retained ${lease.resource.server.url} for ${q.externalSessionId}`)
      return { url: lease.resource.server.url, release: async () => lease.release() }
    },
    async dispose() {
      await Promise.allSettled([...live.keys()].map((s) => s.close()))
      await pool.disposeAll()
    },
  }
}
