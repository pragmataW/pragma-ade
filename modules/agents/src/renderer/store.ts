import type { IpcContract } from '@pragma/sdk'
import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  type AgentProfile,
  type AgentSession,
  agentsIpc,
  type ProfileCheck,
  type ProviderInfo,
  type SessionChangedPayload,
} from '../contract'
import { initialActiveTab, nextActiveTab } from './view-model'

/** The renderer IPC surface the store needs (`ctx.ipc`). */
export interface AgentsIpcClient {
  invoke<I, O>(c: IpcContract<I, O>, input: I): Promise<O>
}

export interface AgentsState {
  providers: ProviderInfo[]
  profiles: AgentProfile[]
  sessions: Record<string, AgentSession[]>
  activeSessionId: Record<string, string | null>
  launcher: { open: boolean; worktreeId: string | null }
  checks: Record<string, ProfileCheck>
  init(): Promise<void>
  loadSessions(worktreeId: string): Promise<void>
  selectSession(worktreeId: string, id: string): void
  openLauncher(worktreeId?: string | null): void
  closeLauncher(): void
  applySessionChanged(p: SessionChangedPayload): void
  applyProfilesChanged(p: { profiles: AgentProfile[] }): void
  refreshCheck(profileId: string): Promise<ProfileCheck>
}
export type AgentsStore = StoreApi<AgentsState>

const byOrdinal = (a: AgentSession, b: AgentSession) => a.ordinal - b.ordinal

function upsert(list: readonly AgentSession[], s: AgentSession): AgentSession[] {
  return [...list.filter((x) => x.id !== s.id), s].sort(byOrdinal)
}

export function createAgentsStore(ipc: AgentsIpcClient, warn: (m: string, e: unknown) => void): AgentsStore {
  return createStore<AgentsState>()((set, get) => {
    function removeSession(s: AgentSession): void {
      const list = get().sessions[s.worktreeId] ?? []
      const active = get().activeSessionId[s.worktreeId]
      const next = active === s.id ? nextActiveTab(list, s.id) : (active ?? null)
      set((st) => ({
        sessions: { ...st.sessions, [s.worktreeId]: list.filter((x) => x.id !== s.id) },
        activeSessionId: { ...st.activeSessionId, [s.worktreeId]: next },
      }))
    }

    return {
      providers: [],
      profiles: [],
      sessions: {},
      activeSessionId: {},
      launcher: { open: false, worktreeId: null },
      checks: {},
      async init() {
        const [providers, profiles] = await Promise.all([
          ipc.invoke(agentsIpc.listProviders, undefined),
          ipc.invoke(agentsIpc.listProfiles, undefined),
        ])
        set({ providers, profiles })
      },
      async loadSessions(worktreeId) {
        const list = await ipc.invoke(agentsIpc.listSessions, { worktreeId })
        set((st) => ({
          sessions: { ...st.sessions, [worktreeId]: list.sort(byOrdinal) },
          activeSessionId: { ...st.activeSessionId, [worktreeId]: initialActiveTab(list) },
        }))
      },
      selectSession(worktreeId, id) {
        set((st) => ({ activeSessionId: { ...st.activeSessionId, [worktreeId]: id } }))
        ipc.invoke(agentsIpc.focusSession, { id }).catch((e: unknown) => warn('focusSession failed', e))
      },
      openLauncher(worktreeId = null) {
        set({ launcher: { open: true, worktreeId } })
      },
      closeLauncher() {
        set({ launcher: { open: false, worktreeId: null } })
      },
      applySessionChanged({ session, reveal }) {
        if (session.closedAt !== null) return removeSession(session)
        const wt = session.worktreeId
        set((st) => ({
          sessions: { ...st.sessions, [wt]: upsert(st.sessions[wt] ?? [], session) },
          activeSessionId:
            reveal || !st.activeSessionId[wt] ? { ...st.activeSessionId, [wt]: session.id } : st.activeSessionId,
        }))
      },
      applyProfilesChanged({ profiles }) {
        set({ profiles, checks: {} })
      },
      async refreshCheck(profileId) {
        const check = await ipc.invoke(agentsIpc.checkProfile, { id: profileId })
        set((st) => ({ checks: { ...st.checks, [profileId]: check } }))
        return check
      },
    }
  })
}
