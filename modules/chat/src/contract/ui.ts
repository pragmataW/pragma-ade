/** The chat UI kit contract (§5.4): type-only React imports, so providers compose their own chat UI. */
import type { ClipboardEvent, ComponentType, DragEvent } from 'react'
import type { ChatImage, ChatPermissionDecision, ChatSupport, ChatUserInput } from './capability'
import type { ChatEventEnvelope, ChatEventKind } from './events'
import type { ComposerAppend } from './ipc'
import type { ChatOptionValue } from './options'
import type { ChatSettings } from './settings'
import type { ChatSessionStatus } from './status'
import type { ChatItem, ChatTranscript } from './transcript'

/** What every part and slot gets: the session's live state and its actions. */
export interface ChatSessionApi {
  sessionId: string
  providerId: string
  transcript: ChatTranscript
  status: ChatSessionStatus
  send(input: ChatUserInput): Promise<{ queued: boolean }>
  interrupt(): Promise<void>
  cancelQueued(id: string): Promise<void>
  respondPermission(requestId: string, d: ChatPermissionDecision): Promise<void>
  /** For interactive custom parts (e.g. 11b's FormCard). */
  respond(eventId: string, payload: unknown): Promise<void>
  setOption(key: string, value: ChatOptionValue): Promise<void>
  searchFiles(query: string): Promise<string[]>
}

export interface ChatPartProps<I extends ChatItem = ChatItem> {
  item: I
  session: ChatSessionApi
}
/** A part for one item kind (`never` keeps any `ChatPartProps<SomeItem>` component assignable). */
export type ChatPartComponent = ComponentType<ChatPartProps<never>>

export interface ChatSlotProps {
  session: ChatSessionApi
}
export type ChatSlotComponent = ComponentType<ChatSlotProps>

export interface ComposerApi {
  text: string
  setText(t: string): void
  insertAtCursor(t: string): void
  replaceToken(start: number, end: number, t: string): void
  images: ChatImage[]
  addImages(i: ChatImage[]): void
  removeImage(index: number): void
  /** Shows a translated, transient composer notice (e.g. an image that is too large). */
  notify(messageKey: string): void
  session: ChatSessionApi
}

export interface ComposerMenuProps {
  query: string
  api: ComposerApi
  onPick(insert: string): void
  onClose(): void
  activeIndex: number
  setCount(n: number): void
}

export interface ComposerExtension {
  id: string
  /** e.g. '/' (line start), '@'. */
  trigger?: { char: string; atLineStart?: boolean; menu: ComponentType<ComposerMenuProps> }
  /** e.g. the attach button. */
  toolbar?: ComponentType<{ api: ComposerApi }>
  /** e.g. image thumbnails. */
  aboveInput?: ComponentType<{ api: ComposerApi }>
  /** true = handled. */
  onPaste?(e: ClipboardEvent, api: ComposerApi): boolean
  onDrop?(e: DragEvent, api: ComposerApi): boolean
}

export type ChatPartKey = ChatEventKind | `custom:${string}`

export interface ChatUiDefinition {
  /** Item kind → component. A kind missing from the map is not rendered. */
  parts: Partial<Record<ChatPartKey, ChatPartComponent>>
  header?: ChatSlotComponent[]
  composerToolbar?: ChatSlotComponent[]
  composerExtensions?: ComposerExtension[]
  sidePanels?: ChatSlotComponent[]
  /** Default true: consecutive tool-call items render inside one `ToolCallGroup`. */
  groupToolCalls?: boolean
  /** Default `AssistantTurnHeader` (provider mark + name + time); null hides it. */
  turnHeader?: ChatSlotComponent | null
}

declare module '@pragma/sdk' {
  interface RendererCapabilityMap {
    chatUi: ChatUiDefinition
  }
}

/** A subscription that can be undone. */
export interface ChatSubscription {
  dispose(): void
}

/**
 * Everything the kit needs from the app (built once by `ChatView` from the SDK context, stubbed in tests), so parts
 * never touch SDK or 03 shapes directly.
 */
export interface ChatHost {
  open(sessionId: string): Promise<{ providerId: string; transcript: ChatTranscript; status: ChatSessionStatus }>
  onEvent(cb: (env: ChatEventEnvelope) => void): ChatSubscription
  onComposerAppend(cb: (p: ComposerAppend) => void): ChatSubscription
  send(sessionId: string, input: ChatUserInput): Promise<{ queued: boolean }>
  interrupt(sessionId: string): Promise<void>
  cancelQueued(sessionId: string, queuedId: string): Promise<void>
  respondPermission(sessionId: string, requestId: string, decision: ChatPermissionDecision): Promise<void>
  respond(sessionId: string, eventId: string, payload: unknown): Promise<void>
  setOption(sessionId: string, key: string, value: ChatOptionValue): Promise<void>
  searchFiles(sessionId: string, query: string): Promise<string[]>
  checkSupport(profileId: string): Promise<ChatSupport>
  chatUi(providerId: string): ChatUiDefinition | undefined
  providerName(providerId: string): string
  ProviderMark: ComponentType<{ providerId: string; size?: number }>
  /** 04's `StatusIcon` when agent-status is active, else null (the kit draws a fallback). */
  StatusIcon: ComponentType<{ status: ChatSessionStatus; turnCompleted: boolean; size?: 'sm' | 'md' }> | null
  openExternal(url: string): void
  settings: {
    get(): ChatSettings
    update(patch: Partial<ChatSettings>): Promise<unknown>
    subscribe(cb: () => void): ChatSubscription
  }
}
