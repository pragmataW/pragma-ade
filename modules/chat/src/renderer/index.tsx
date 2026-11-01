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

export { ChatHostProvider, useChatHost } from './host-adapter'
export { ContextMeter, ContextMeterView, contextPercent } from './kit/controls/ContextMeter'
export { defaultChatUi } from './kit/default-ui'
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
