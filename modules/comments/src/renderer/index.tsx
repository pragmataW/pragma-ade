import { AGENT_SLOTS, type AgentSessionToolbarProps } from '@pragma/module-agents/contract'
import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { COMMENTS_MODULE_ID, SLOT_ENTRY_IDS, SLOT_ORDER } from '../constants'
import { type CommentsSettings, CommentsUiServiceToken, type OpenDrawerArgs, openDrawerCommand } from '../contract'
import { CommentComposer } from './components/CommentComposer'
import { CommentsSettingsPage } from './components/CommentsSettingsPage'
import { TitlebarEntry } from './components/TitlebarEntry'
import { ToolbarBadge } from './components/ToolbarBadge'
import { setRuntime } from './runtime'
import { useCommentsStore } from './store'
import { createSendFlow } from './use-send-flow'

const SETTINGS_ICON = 'message-square'
const openDrawer = (args?: OpenDrawerArgs) => useCommentsStore.getState().openDrawer(args)

export default defineRendererModule<CommentsSettings>({
  activate(ctx) {
    setRuntime(ctx)
    useCommentsStore.getState().init()
    ctx.slots.register(ShellSlots.titlebarRight, {
      id: SLOT_ENTRY_IDS.titlebar,
      order: SLOT_ORDER,
      component: TitlebarEntry,
    })
    ctx.slots.register<AgentSessionToolbarProps>(AGENT_SLOTS.toolbar, {
      id: SLOT_ENTRY_IDS.toolbar,
      order: SLOT_ORDER,
      component: ToolbarBadge,
    })
    ctx.commands.register(openDrawerCommand, (args) => openDrawer(openDrawerCommand.args.parse(args)), {
      titleKey: 'comments:commands.openDrawer',
      palette: true,
    })
    ctx.settingsPages.register({
      id: COMMENTS_MODULE_ID,
      titleKey: 'comments:settings.title',
      order: SETTINGS_PAGE_ORDER.comments,
      icon: SETTINGS_ICON,
      component: CommentsSettingsPage,
    })
    const flow = createSendFlow(ctx, useCommentsStore)
    ctx.services.provide(CommentsUiServiceToken, { CommentComposer, openDrawer, send: flow.send })
  },
})
