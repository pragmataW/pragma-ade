/** The only main file that touches other modules (projects, terminal, agents) and the renderer bridge. */
import {
  type AgentSession,
  type AgentSessionStartedPayload,
  AgentSessionsServiceToken,
  agentSessionStarted,
  isRunningStatus,
} from '@pragma/module-agents/contract'
import { worktreeRemoved } from '@pragma/module-projects/contract'
import { PtyServiceToken } from '@pragma/module-terminal/contract'
import type { MainContext } from '@pragma/sdk/main'
import type { TargetSession } from '../contract'

export type SessionRef = Pick<AgentSession, 'id' | 'worktreeId' | 'title' | 'mode' | 'status' | 'ptyId' | 'closedAt'>

/** Open and not exited/errored (03's `isRunningStatus`). */
export const isRunning = (s: SessionRef): boolean => s.closedAt == null && isRunningStatus(s.status)
export const toTargetSession = (s: SessionRef): TargetSession => ({
  id: s.id,
  title: s.title,
  mode: s.mode,
  status: s.status,
})

export interface CommentsUpstream {
  listSessions(worktreeId: string): Promise<SessionRef[]>
  getSession(id: string): Promise<SessionRef | undefined>
  lastFocusedSession(worktreeId: string): Promise<SessionRef | undefined>
  paste(ptyId: string, text: string): void
  isBracketedPasteEnabled(ptyId: string): boolean
  write(ptyId: string, data: string): void
  onPtyData(ptyId: string, cb: () => void): () => void
  onSessionStarted(cb: (e: AgentSessionStartedPayload) => void): () => void
  onWorktreeRemoved(cb: (worktreeId: string) => void): () => void
  publish: MainContext['ipc']['publish']
}

export function createUpstream(ctx: MainContext): CommentsUpstream {
  const agents = ctx.services.get(AgentSessionsServiceToken)
  const pty = ctx.services.get(PtyServiceToken)
  return {
    listSessions: (worktreeId) => agents.listSessions(worktreeId),
    getSession: async (id) => (await agents.getSession(id)) ?? undefined,
    lastFocusedSession: async (worktreeId) => (await agents.getLastFocusedSession(worktreeId)) ?? undefined,
    paste: (ptyId, text) => pty.paste(ptyId, text),
    isBracketedPasteEnabled: (ptyId) => pty.isBracketedPasteEnabled(ptyId),
    write: (ptyId, data) => pty.write(ptyId, data),
    onPtyData: (ptyId, cb) => pty.onData(ptyId, () => cb()),
    onSessionStarted(cb) {
      const sub = ctx.events.on(agentSessionStarted, cb)
      return () => sub.dispose()
    },
    onWorktreeRemoved(cb) {
      const sub = ctx.events.on(worktreeRemoved, (e) => cb(e.worktreeId))
      return () => sub.dispose()
    },
    publish: (contract, payload) => ctx.ipc.publish(contract, payload),
  }
}
