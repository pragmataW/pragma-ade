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
  /** Texts appended to a session's composer (`ChatService.appendToComposer`), not yet taken by the composer. */
  appends: Record<string, string[]>
  /** The chat session whose view is active (status bar context %). */
  activeSessionId: string | null
  hydrate(sessionId: string, snapshot: ChatSnapshotDto): void
  /** Drops envelopes at or below the session's `lastSeq` (and for sessions not hydrated). */
  apply(env: ChatEventEnvelope): void
  pushComposerAppend(sessionId: string, text: string): void
  consumeComposerAppend(sessionId: string): string[]
  setActive(sessionId: string | null): void
}

export const useChatStore = create<ChatStoreState>((set, get) => ({
  sessions: {},
  appends: {},
  activeSessionId: null,
  hydrate: (sessionId, snapshot) => set((s) => ({ sessions: { ...s.sessions, [sessionId]: { ...snapshot } } })),
  apply(env) {
    const entry = get().sessions[env.sessionId]
    if (!entry || env.seq <= entry.transcript.lastSeq) return
    const transcript = reduceTranscript(entry.transcript, env)
    const status = nextStatus(entry.status, env.event, { pendingInteractions: transcript.pendingInteractions })
    set((s) => ({ sessions: { ...s.sessions, [env.sessionId]: { ...entry, transcript, status } } }))
  },
  pushComposerAppend: (sessionId, text) =>
    set((s) => ({ appends: { ...s.appends, [sessionId]: [...(s.appends[sessionId] ?? []), text] } })),
  consumeComposerAppend(sessionId) {
    const taken = get().appends[sessionId] ?? []
    if (taken.length > 0) set((s) => ({ appends: { ...s.appends, [sessionId]: [] } }))
    return taken
  },
  setActive: (activeSessionId) => set({ activeSessionId }),
}))
