import type { AgentProfile } from '@pragma/module-agents/contract'
import { z } from '@pragma/sdk'
import {
  ATTACHMENT_KIND,
  type ATTACHMENT_KINDS,
  DOCUMENT_MEDIA_TYPES,
  IMAGE_MEDIA_TYPES,
  PDF_MEDIA_TYPE,
} from './constants'
import type { ChatEvent, ChatMcpServer, ChatPermissionOptionId } from './events'

export type ChatAttachmentKind = (typeof ATTACHMENT_KINDS)[number]

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

/** A PDF or text document (sent only to providers whose `attachmentKinds` include its kind). */
export const chatFileSchema = z.object({
  name: z.string(),
  mediaType: z.enum(DOCUMENT_MEDIA_TYPES),
  dataBase64: z.string(),
})
export type ChatFile = z.infer<typeof chatFileSchema>

export const chatUserInputSchema = z.object({
  text: z.string(),
  images: z.array(chatImageSchema),
  files: z.array(chatFileSchema).optional(),
  /** Core-filled: the transcript id of this user message (a provider may reuse it as its own message id). */
  messageId: z.string().optional(),
})
export type ChatUserInput = z.infer<typeof chatUserInputSchema>

/** The attachment kind of a document media type. */
export const documentKindOf = (mediaType: ChatFile['mediaType']): ChatAttachmentKind =>
  mediaType === PDF_MEDIA_TYPE ? ATTACHMENT_KIND.pdf : ATTACHMENT_KIND.text

export type ChatPermissionDecision = ChatPermissionOptionId

/** What the core tells `send` besides the input (adapters map `messageId` to their own ids, e.g. for `rewind`). */
export interface ChatSendMeta {
  messageId: string
}

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
  /** The core calls this only when no turn is active; `meta.messageId` is the transcript `message` it started. */
  send(input: ChatUserInput, meta?: ChatSendMeta): Promise<void>
  interrupt(): Promise<void>
  respondPermission(requestId: string, decision: ChatPermissionDecision): Promise<void>
  /** §10.3: reply to an `awaitsResponse` custom event; the adapter validates `payload`. */
  respond?(eventId: string, payload: unknown): Promise<void>
  /** Cancels pending interactions and emits `session-exit{reason:'closed'}` exactly once. */
  close(): Promise<void>
  /** Owner extension: kill the process now (`stop` with signal `kill`). */
  kill?(): void
  // Optional session actions (`chat.action`, `CHAT_SESSION_ACTIONS`); the core lists the implemented ones in
  // `session-info.actions` and the kit shows a control only when its action is listed. Permission modes stay an
  // option (`setOption('permissionMode', …)`).
  /** `refreshMcp`: the current servers; the core emits them as `mcp-status`. */
  listMcp?(): Promise<ChatMcpServer[]>
  toggleMcp?(name: string, enabled: boolean): Promise<void>
  reconnectMcp?(name: string): Promise<void>
  /** Restores files (and the conversation, when supported) to before the user message `messageId`. */
  rewind?(messageId: string): Promise<void>
  /** Stops a running `task` (subagent, workflow or background job). */
  stopTask?(taskId: string): Promise<void>
  /** Forks the conversation (at `messageId`, else at its end). */
  fork?(messageId?: string): Promise<void>
}

export type ChatSupport = { ok: true } | { ok: false; reasonKey: string; detail?: string }

export interface ChatCapability {
  /** Attachment kinds `send` accepts; default `['image']` (the core drops `files` of other kinds). */
  attachmentKinds?: readonly ChatAttachmentKind[]
  /**
   * The provider takes user messages while a turn runs (the agent folds them in itself): the core sends them right
   * away (`message.midTurn`) instead of queueing them until the turn ends. Default false.
   */
  midTurnInput?: boolean
  checkSupport(profile: AgentProfile): Promise<ChatSupport>
  /** Resolves after the protocol handshake; rejects with `ChatStartupError`. */
  createSession(ctx: ChatSessionContext): Promise<ChatSessionHandle>
  /** Owner widening: the transcript of an earlier session. */
  loadHistory?(ctx: ChatHistoryContext): Promise<ChatEvent[]>
  /**
   * Provider-owned settings RPC: the provider's `chatUi.settingsPage` sends `request` through `chat.providerCall`
   * (e.g. connecting model providers); the adapter validates it and answers plain data.
   */
  settingsCall?(request: unknown): Promise<unknown>
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

/** A session that could not start; `reasonKey` is a `chat:unsupported.*` or a `chat:resume.*` (`RESUME_REASON`) key. */
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
