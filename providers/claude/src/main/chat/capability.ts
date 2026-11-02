import { ATTACHMENT_KINDS, type ChatCapability, EVENT_KIND } from '@pragma/module-chat/contract'
import type { CapabilityContext } from '@pragma/sdk'
import { loadClaudeHistory } from './history'
import { ClaudeChatSession, type ClaudeSessionDeps } from './session'
import { checkClaudeSupport } from './support'

/** `chat` capability (factory form, §10.2): live sessions are tracked so `dispose` can close them on quit. */
export function createClaudeChatCapability(
  capCtx: Pick<CapabilityContext, 'log' | 'resolveCommand'>,
  deps: Omit<ClaudeSessionDeps, 'log'> = {},
): ChatCapability {
  const live = new Set<ClaudeChatSession>()
  return {
    // images, PDFs and text files become image / document blocks of the user turn
    attachmentKinds: ATTACHMENT_KINDS,
    checkSupport: (profile) => checkClaudeSupport(profile, (cmd) => capCtx.resolveCommand(cmd)),
    async createSession(ctx) {
      let session: ClaudeChatSession | undefined
      const emit: typeof ctx.emit = (e) => {
        if (e.kind === EVENT_KIND.sessionExit && session) live.delete(session)
        ctx.emit(e)
      }
      capCtx.log.info(`claude chat ${ctx.sessionId}: spawning ${ctx.profile.command}`)
      session = await ClaudeChatSession.start({ ...ctx, emit }, { ...deps, log: capCtx.log })
      live.add(session)
      return session
    },
    loadHistory: loadClaudeHistory,
    async dispose() {
      await Promise.allSettled([...live].map((s) => s.close()))
    },
  }
}
