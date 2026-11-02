import { AGENT_SLOTS, type AgentLauncherOptionsProps, type AgentSessionViewProps } from '@pragma/module-agents/contract'
import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import {
  CHAT_MODE_OPTION_ID,
  CHAT_SETTINGS_ICON,
  CHAT_SLOT_ENTRY_ID,
  CHAT_STATUSBAR_ID,
  CHAT_STATUSBAR_ORDER,
  CHAT_VIEW_ORDER,
} from '../constants'
import { CHAT_MODE, CHAT_MODULE_ID, type ChatSettings, chatIpcEvents } from '../contract'
import { withChatHost } from './host-adapter'
import { useChatStore } from './session/store'
import { ChatSettingsPage } from './view/ChatSettingsPage'
import { ChatSessionView } from './view/ChatView'
import { LauncherModeOption } from './view/LauncherModeOption'
import { StatusbarContext } from './view/StatusbarContext'

export type {
  ChatPartComponent,
  ChatPartProps,
  ChatSessionApi,
  ChatSlotComponent,
  ChatSlotProps,
  ChatTurnHeaderProps,
  ChatUiDefinition,
  ComposerApi,
  ComposerExtension,
  ComposerMenuProps,
} from '../contract'
export { ChatHostProvider, useChatHost } from './host-adapter'
export { Composer } from './kit/composer/Composer'
export { ComposerAttachments } from './kit/composer/ComposerAttachments'
export {
  defaultComposerExtensions,
  fileMentionExtension,
  imageAttachmentsExtension,
  slashCommandsExtension,
} from './kit/composer/extensions'
export { FileMention } from './kit/composer/FileMention'
export { QueueChips } from './kit/composer/QueueChips'
export { readImageFiles } from './kit/composer/read-images'
export { SlashCommandMenu } from './kit/composer/SlashCommandMenu'
export { ContextMeter, ContextMeterView, contextPercent } from './kit/controls/ContextMeter'
export { ModelPicker } from './kit/controls/ModelPicker'
export { createOptionPicker, OptionPicker } from './kit/controls/OptionPicker'
export { StopButton } from './kit/controls/StopButton'
export { UsageMeter } from './kit/controls/UsageMeter'
export { defaultChatUi } from './kit/default-ui'
export { AssistantText } from './kit/parts/AssistantText'
export { AssistantTurnHeader } from './kit/parts/AssistantTurnHeader'
export { ErrorRow, useErrorText } from './kit/parts/ErrorRow'
export { FileEditDiff } from './kit/parts/FileEditDiff'
export { HunkDiff } from './kit/parts/HunkDiff'
export { CollapsibleCard } from './kit/parts/lib/CollapsibleCard'
export { MonoPre } from './kit/parts/lib/MonoPre'
export { StatusGlyph } from './kit/parts/lib/StatusGlyph'
export { MessageList } from './kit/parts/MessageList'
export { SessionExitNotice, TurnEndNotice } from './kit/parts/Notices'
export { PermissionCard } from './kit/parts/PermissionCard'
export { ThinkingBlock } from './kit/parts/ThinkingBlock'
export { TodoList } from './kit/parts/TodoList'
export { ToolCallCard } from './kit/parts/ToolCallCard'
export { ToolCallGroup } from './kit/parts/ToolCallGroup'
export { UserMessage } from './kit/parts/UserMessage'
export { useCustomResponse } from './kit/parts/use-custom-response'
export { WorkingLine } from './kit/parts/WorkingLine'
export { ChatSessionProvider, useChatSessionApi } from './session/ChatSessionContext'
export { useChatStore } from './session/store'
export { ChatSessionView } from './view/ChatView'
export { resolveChatUi } from './view/resolve-definition'

/** `agentSession.view` (mode chat), the New agent mode option, Settings › Chat and the status bar context %. */
export const ChatView = withChatHost(ChatSessionView)

export default defineRendererModule<ChatSettings>({
  activate(ctx) {
    ctx.ipc.subscribe(chatIpcEvents.composerAppend, (p) =>
      useChatStore.getState().pushComposerAppend(p.sessionId, p.text),
    )
    ctx.slots.register<AgentSessionViewProps>(AGENT_SLOTS.view, {
      id: CHAT_SLOT_ENTRY_ID,
      order: CHAT_VIEW_ORDER,
      match: (p) => p.session.mode === CHAT_MODE,
      component: ChatView,
    })
    ctx.slots.register<AgentLauncherOptionsProps>(AGENT_SLOTS.launcherOptions, {
      id: CHAT_MODE_OPTION_ID,
      order: CHAT_VIEW_ORDER,
      component: withChatHost(LauncherModeOption),
    })
    ctx.slots.register(ShellSlots.statusbarRight, {
      id: CHAT_STATUSBAR_ID,
      order: CHAT_STATUSBAR_ORDER,
      component: StatusbarContext,
    })
    ctx.settingsPages.register({
      id: CHAT_MODULE_ID,
      titleKey: 'chat:settings.title',
      order: SETTINGS_PAGE_ORDER.chat,
      icon: CHAT_SETTINGS_ICON,
      component: withChatHost(ChatSettingsPage),
    })
  },
})
