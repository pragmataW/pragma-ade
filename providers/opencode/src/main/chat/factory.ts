import { type ChatCapability, EVENT_KIND } from '@pragma/module-chat/contract'
import type { CapabilityContext } from '@pragma/sdk'
import { loadOpencodeHistory } from './history-loader'
import { createConnectionPool } from './server/connection'
import { OpencodeChatSession } from './session'
import { checkOpencodeSupport } from './support'

export type OpencodeChatCapability = ChatCapability & { dispose(): Promise<void> }

/** `chat` capability (factory form, §10.2): one connection pool; `dispose` closes live sessions and stops every server. */
export function createOpencodeChat(
  capCtx: Pick<CapabilityContext, 'log' | 'getShellEnv' | 'resolveCommand'>,
  o: { idleGraceMs?: number } = {},
): OpencodeChatCapability {
  const pool = createConnectionPool({ log: capCtx.log, idleGraceMs: o.idleGraceMs })
  const live = new Set<OpencodeChatSession>()
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
      live.add(session)
      return session
    },
    loadHistory: loadOpencodeHistory(pool, () => capCtx.getShellEnv()),
    async dispose() {
      await Promise.allSettled([...live].map((s) => s.close()))
      await pool.disposeAll()
    },
  }
}
