import { createServiceToken } from '@pragma/sdk'
import { CHAT_SERVICE_ID } from './constants'
import type { ChatTranscript } from './transcript'

export interface ChatStartGuardInput {
  sessionId: string
  providerId: string
  externalSessionId: string
}
export type ChatStartGuardResult = { ok: true } | { ok: false; reasonKey: string }
/** 11c: runs before every start that resumes (including the dormant-send auto-resume). */
export type ChatStartGuard = (s: ChatStartGuardInput) => ChatStartGuardResult

/** A resume found no conversation (`RESUME_REASON.notFound`), so a fresh session was started in its place. */
export interface ChatResumeFallback {
  sessionId: string
  /** The id that could not be resumed. */
  externalSessionId: string
}
export type ChatResumeFallbackListener = (e: ChatResumeFallback) => void

/** `ChatServiceToken` (§7): 11c delivers comments through `appendToComposer` (appended, never auto-sent). */
export interface ChatService {
  /** Queued in a main-side inbox until the session's composer takes it; `chipLabels` makes it a chip. */
  appendToComposer(sessionId: string, text: string, opts?: { chipLabels?: string[] }): void
  /** The live transcript, else the dormant one rebuilt from the provider's history. */
  getHistory(sessionId: string): Promise<ChatTranscript>
  /** A non-ok result refuses the resume (`error{fatal}` with the reason key); returns the unregister function. */
  registerStartGuard(guard: ChatStartGuard): () => void
  /** Called after a resume fell back to a fresh session; returns the unsubscribe function. */
  onResumeFallback(listener: ChatResumeFallbackListener): () => void
}
export const ChatServiceToken = createServiceToken<ChatService>(CHAT_SERVICE_ID)
