import { create } from 'zustand'
import {
  type ChatEventEnvelope,
  type ChatSessionStatus,
  type ChatSnapshotDto,
  type ChatTranscript,
  nextStatus,
  reduceTranscript,
} from '../../contract'

export interface ChatSessionEntry {
  providerId: string
  transcript: ChatTranscript
  status: ChatSessionStatus
}

export interface ChatStoreState {
  sessions: Record<string, ChatSessionEntry>
  /** Bumped on `chat.composerInboxChanged`: the session's composer then takes its main-side inbox. */
  inboxVersions: Record<string, number>
  /** The chat session whose view is active (status bar context %). */
  activeSessionId: string | null
  hydrate(sessionId: string, snapshot: ChatSnapshotDto): void
  /** Drops envelopes at or below the session's `lastSeq` (and for sessions not hydrated). */
  apply(env: ChatEventEnvelope): void
  bumpInbox(sessionId: string): void
  setActive(sessionId: string | null): void
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessions: {},
  inboxVersions: {},
  activeSessionId: null,
  hydrate: (sessionId, snapshot) => set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...snapshot } } })),
  apply(env) {
    const entry = get().sessions[env.sessionId]
    if (!entry || env.seq <= entry.transcript.lastSeq) return
    const transcript = reduceTranscript(entry.transcript, env)
    const status = nextStatus(entry.status, env.event, { pendingInteractions: transcript.pendingInteractions })
    set((s) => ({ sessions: { ...s.sessions, [env.sessionId]: { ...entry, transcript, status } } }))
  },
  bumpInbox: (sessionId) =>
    set((s) => ({ inboxVersions: { ...s.inboxVersions, [sessionId]: (s.inboxVersions[sessionId] ?? 0) + 1 } })),
  setActive: (activeSessionId) => set({ activeSessionId }),
}))
