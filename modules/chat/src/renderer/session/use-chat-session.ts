import { useEffect, useMemo } from 'react'
import type { ChatEventEnvelope, ChatSessionApi } from '../../contract'
import { useChatHost } from '../host-adapter'
import { useChatStore } from './store'

/** Subscribe (buffering) → open → hydrate → flush the buffer; live events then apply directly (RF3). */
export function useChatSession(sessionId: string): ChatSessionApi | null {
  const host = useChatHost()
  useEffect(() => {
    let hydrated = false
    let disposed = false
    const buffer: ChatEventEnvelope[] = []
    const { apply, hydrate } = useChatStore.getState()
    const sub = host.onEvent((env) => {
      if (env.sessionId !== sessionId) return
      if (hydrated) apply(env)
      else buffer.push(env)
    })
    host
      .open(sessionId)
      .then((snapshot) => {
        if (disposed) return
        hydrate(sessionId, snapshot)
        hydrated = true
        for (const env of buffer.splice(0)) apply(env)
      })
      .catch((e: unknown) => console.warn(`chat: open ${sessionId} failed`, e))
    return () => {
      disposed = true
      sub.dispose()
    }
  }, [host, sessionId])
  const entry = useChatStore((s) => s.sessions[sessionId])
  return useMemo(() => {
    if (!entry) return null
    return {
      sessionId,
      providerId: entry.providerId,
      transcript: entry.transcript,
      status: entry.status,
      ...(entry.worktree ? { worktree: entry.worktree } : {}),
      send: (input) => host.send(sessionId, input),
      interrupt: () => host.interrupt(sessionId),
      cancelQueued: (id) => host.cancelQueued(sessionId, id),
      respondPermission: (requestId, d) => host.respondPermission(sessionId, requestId, d),
      respond: (eventId, payload) => host.respond(sessionId, eventId, payload),
      setOption: (key, value) => host.setOption(sessionId, key, value),
      searchFiles: (query) => host.searchFiles(sessionId, query),
    }
  }, [entry, host, sessionId])
}
