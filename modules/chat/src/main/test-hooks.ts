import { defineTestHooks } from '@pragma/sdk/main'
import { type ChatSnapshotDto, chatTestIpc } from '../contract'
import { getChatRuntime } from './runtime'

/** `globalThis.__pragmaChatTest` (PRAGMA_TEST only): the live snapshot without dormant loading. */
export interface ChatTestHooks {
  snapshot(sessionId: string): ChatSnapshotDto | null
}
export type ChatTestGlobal = { __pragmaChatTest: ChatTestHooks }

export default defineTestHooks((ctx) => {
  const hooks: ChatTestHooks = {
    snapshot: (sessionId) => getChatRuntime().registry.get(sessionId)?.snapshot() ?? null,
  }
  ;(globalThis as unknown as ChatTestGlobal).__pragmaChatTest = hooks
  ctx.ipc.handle(chatTestIpc.snapshot, ({ sessionId }) => hooks.snapshot(sessionId))
})
