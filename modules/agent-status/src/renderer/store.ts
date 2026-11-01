import { create } from 'zustand'
import type { SessionStatusInfo, WorktreeStatusInfo } from '../contract'

export interface AgentStatusState {
  sessions: Record<string, SessionStatusInfo>
  worktrees: Record<string, WorktreeStatusInfo>
  hydrate(l: { sessions: SessionStatusInfo[]; worktrees: WorktreeStatusInfo[] }): void
  upsertSession(i: SessionStatusInfo): void
  upsertWorktree(i: WorktreeStatusInfo): void
}

const byKey = <T>(items: T[], key: (t: T) => string): Record<string, T> =>
  Object.fromEntries(items.map((i) => [key(i), i]))

/** Renderer mirror of the main-side status store (hydrated by `agent-status.list`, then IPC events). */
export const useAgentStatusStore = create<AgentStatusState>((set) => ({
  sessions: {},
  worktrees: {},
  hydrate: (l) =>
    set((s) => ({
      sessions: { ...byKey(l.sessions, (x) => x.sessionId), ...s.sessions },
      worktrees: { ...byKey(l.worktrees, (x) => x.worktreeId), ...s.worktrees },
    })),
  upsertSession: (i) => set((s) => ({ sessions: { ...s.sessions, [i.sessionId]: i } })),
  upsertWorktree: (i) => set((s) => ({ worktrees: { ...s.worktrees, [i.worktreeId]: i } })),
}))
