import type { AgentProfile } from '@pragma/module-agents/contract'
import { z } from '@pragma/sdk'
import { IMAGE_MEDIA_TYPES } from './constants'
import type { ChatEvent, ChatPermissionOptionId } from './events'
import type { ChatOptionDescriptor, ChatOptionValue } from './options'

declare module '@pragma/sdk' {
  interface CapabilityMap {
    chat: ChatCapability
  }
}

export const chatImageSchema = z.object({
  name: z.string(),
  mediaType: z.enum(IMAGE_MEDIA_TYPES),
  dataBase64: z.string(),
})
export type ChatImage = z.infer<typeof chatImageSchema>

export const chatUserInputSchema = z.object({ text: z.string(), images: z.array(chatImageSchema) })
export type ChatUserInput = z.infer<typeof chatUserInputSchema>

export type ChatPermissionDecision = ChatPermissionOptionId

export interface ChatSessionContext {
  sessionId: string
  profile: AgentProfile
  worktreePath: string
  /** The FULL child env from `AgentSessionsService.buildLaunchEnv` (adapters never re-merge). */
  env: Record<string, string>
  resumeExternalSessionId?: string
  initialOptions?: Record<string, ChatOptionValue>
  startupTimeoutMs: number
  /** Core sink; adapters emit synchronously and never buffer. */
  emit(event: ChatEvent): void
}

export interface ChatHistoryContext {
  profile: AgentProfile
  worktreePath: string
  env: Record<string, string>
  externalSessionId: string
}

export interface ChatSessionHandle {
  readonly externalSessionId: string
  /** Current snapshot; the adapter also emits `{kind:'options'}` on change. */
  describeOptions(): ChatOptionDescriptor[]
  /** Rejects on an unknown key or an invalid value. */
  setOption(key: string, value: ChatOptionValue): Promise<void>
  /** The core calls this only when no turn is active. */
  send(input: ChatUserInput): Promise<void>
  interrupt(): Promise<void>
  respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void>
  /** §10.3: reply to an `awaitsResponse` custom event; the adapter validates `payload`. */
  respond?(eventId: string, payload: unknown): Promise<void>
  /** Cancels pending interactions and emits `session-exit{reason:'closed'}` exactly once. */
  close(): Promise<void>
  /** Owner extension: kill the process now (`stop` with signal `kill`). */
  kill?(): void
}

export type ChatSupport = { ok: true } | { ok: false; reasonKey: string; detail?: string }

export interface ChatCapability {
  checkSupport(profile: AgentProfile): Promise<ChatSupport>
  /** Resolves after the protocol handshake; rejects with `ChatStartupError`. */
  createSession(ctx: ChatSessionContext): Promise<ChatSessionHandle>
  /** Owner widening: the transcript of an earlier session. */
  loadHistory?(ctx: ChatHistoryContext): Promise<ChatEvent[]>
  /** §10.2: closes every live handle on app quit. */
  dispose?(): Promise<void> | void
  /**
   * 11c: when a live server for worktree + profile hosts `externalSessionId`, keep it running for a terminal that
   * joins it (`url`) until `release`; undefined when there is none (the TUI then runs its own server).
   */
  retainServer?(q: RetainServerQuery): Promise<RetainedServer | undefined>
}

export interface RetainServerQuery {
  worktreePath: string
  profile: AgentProfile
  externalSessionId: string
}
export interface RetainedServer {
  url: string
  release(): Promise<void>
}

const STARTUP_ERROR_NAME = 'ChatStartupError'

/** A session that could not start; `reasonKey` is a `chat:unsupported.*` key. */
export class ChatStartupError extends Error {
  readonly reasonKey: string
  readonly detail?: string
  constructor(reasonKey: string, detail?: string) {
    super(detail ? `${reasonKey}: ${detail}` : reasonKey)
    this.name = STARTUP_ERROR_NAME
    this.reasonKey = reasonKey
    this.detail = detail
  }
}

export const isChatStartupError = (e: unknown): e is ChatStartupError =>
  e instanceof ChatStartupError || (e instanceof Error && e.name === STARTUP_ERROR_NAME && 'reasonKey' in e)
