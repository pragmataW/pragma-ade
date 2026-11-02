/** The chat UI kit contract (§5.4): type-only React imports, so providers compose their own chat UI. */
import type { ConfirmInput, ThemeMode } from '@pragma/sdk'
import type { ClipboardEvent, ComponentType, DragEvent } from 'react'
import type { ChatSessionAction } from './actions'
import type { ChatFile, ChatImage, ChatPermissionDecision, ChatSupport, ChatUserInput } from './capability'
import type { ChatEventEnvelope, ChatEventKind } from './events'
import type { ChatWorktree, ComposerEntry, ComposerInboxChanged } from './ipc'
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
  /** An optional action listed in `transcript.info.actions` (rejects otherwise). */
  action(a: ChatSessionAction): Promise<void>
  searchFiles(query: string): Promise<string[]>
  /** 11c: the session's worktree, when known (file links). */
  worktree?: ChatWorktree
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
/** The turn header also gets the time of the user message that started the turn. */
export interface ChatTurnHeaderProps extends ChatSlotProps {
  at?: number
}

export interface ComposerApi {
  text: string
  setText(t: string): void
  insertAtCursor(t: string): void
  replaceToken(start: number, end: number, t: string): void
  images: ChatImage[]
  addImages(i: ChatImage[]): void
  removeImage(index: number): void
  /** PDF / text documents (`documentAttachmentsExtension`). */
  files: ChatFile[]
  addFiles(f: ChatFile[]): void
  removeFile(index: number): void
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
  /** Increments on Enter/Tab: the menu then picks its active item. */
  pickRequest: number
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
  /** Full-width notices above the composer (e.g. `RateLimitBanner`, `RetryBanner`). */
  banners?: ChatSlotComponent[]
  /** Default true: consecutive tool-call items render inside one `ToolCallGroup`. */
  groupToolCalls?: boolean
  /** Default `AssistantTurnHeader` (provider mark + name + time); null hides it. */
  turnHeader?: ComponentType<ChatTurnHeaderProps> | null
  /** A Settings page of this provider (registered by the chat module; talks to `ChatCapability.settingsCall`). */
  settingsPage?: ChatProviderSettingsPage
}

export interface ChatProviderSettingsProps {
  providerId: string
  /** `ChatCapability.settingsCall(request)` of this provider (validate the answer). */
  call(request: unknown): Promise<unknown>
}

export interface ChatProviderSettingsPage {
  titleKey: string
  /** A kebab-case lucide name. */
  icon?: string
  component: ComponentType<ChatProviderSettingsProps>
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
  open(sessionId: string): Promise<{
    providerId: string
    transcript: ChatTranscript
    status: ChatSessionStatus
    worktree?: ChatWorktree
  }>
  onEvent(cb: (env: ChatEventEnvelope) => void): ChatSubscription
  onComposerInboxChanged(cb: (p: ComposerInboxChanged) => void): ChatSubscription
  /** Returns and clears the session's pending composer entries (11c). */
  takeComposerInbox(sessionId: string): Promise<ComposerEntry[]>
  send(sessionId: string, input: ChatUserInput): Promise<{ queued: boolean }>
  interrupt(sessionId: string): Promise<void>
  cancelQueued(sessionId: string, queuedId: string): Promise<void>
  respondPermission(sessionId: string, requestId: string, decision: ChatPermissionDecision): Promise<void>
  respond(sessionId: string, eventId: string, payload: unknown): Promise<void>
  action(sessionId: string, a: ChatSessionAction): Promise<void>
  setOption(sessionId: string, key: string, value: ChatOptionValue): Promise<void>
  /** The SDK confirm dialog (`ctx.dialogs.confirm`; e.g. a dangerous permission mode). */
  confirm(o: ConfirmInput): Promise<boolean>
  searchFiles(sessionId: string, query: string): Promise<string[]>
  checkSupport(profileId: string): Promise<ChatSupport>
  /** A provider settings page's RPC (`chat.providerCall`). */
  providerCall(providerId: string, request: unknown): Promise<unknown>
  chatUi(providerId: string): ChatUiDefinition | undefined
  providerName(providerId: string): string
  ProviderMark: ComponentType<{ providerId: string; size?: number }>
  /** 04's `StatusIcon` when agent-status is active, else null (the kit draws a fallback). */
  StatusIcon: ComponentType<{ status: ChatSessionStatus; turnCompleted: boolean; size?: 'sm' | 'md' }> | null
  openExternal(url: string): void
  /** 11c: shell commands (file links run `editor.openFile` / `gitChanges.reveal` only when registered). */
  commands: {
    has(id: string): boolean
    execute(id: string, args: unknown): Promise<unknown>
    /** The registered commands changed (another module activated or announced its commands). */
    onChange(cb: () => void): ChatSubscription
  }
  /** The resolved light/dark mode (diff themes). */
  theme: { get(): ThemeMode; subscribe(cb: () => void): ChatSubscription }
  settings: {
    get(): ChatSettings
    update(patch: Partial<ChatSettings>): Promise<unknown>
    subscribe(cb: () => void): ChatSubscription
  }
}
