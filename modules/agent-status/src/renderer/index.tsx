import { AGENT_SLOTS, type AgentSessionTabBadgesProps } from '@pragma/module-agents/contract'
import { PROJECTS_SLOTS, type WorktreeRowSlotProps } from '@pragma/module-projects/contract'
import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { SETTINGS_PAGE_ID, SLOT_ENTRY_ID, SLOT_ORDER } from '../constants'
import { AgentStatusIpc, AgentStatusIpcEvents, type AgentStatusSettings } from '../contract'
import { BoardCardBadge, type BoardCardBadgeProps } from './BoardCardBadge'
import { SessionTabBadge } from './SessionTabBadge'
import { AgentStatusSettingsPage } from './SettingsPage'
import { StatusbarCounts } from './StatusbarCounts'
import { useAgentStatusStore } from './store'
import { WorktreeRowStatus, WorktreeRowUnread } from './WorktreeRowBadge'

/** Shared with other modules' renderer code (§10.1.1): 09 board cards, 11a chat. */
export { StatusIcon, type StatusIconProps } from './StatusIcon'
export { statusVisual } from './status-visual'

const BOARD_CARD_BADGES_SLOT = 'board.card.badges'
const SETTINGS_ICON = 'bell'

export default defineRendererModule<AgentStatusSettings>({
  activate(ctx) {
    const store = useAgentStatusStore.getState()
    ctx.ipc.subscribe(AgentStatusIpcEvents.sessionChanged, (i) => store.upsertSession(i))
    ctx.ipc.subscribe(AgentStatusIpcEvents.worktreeChanged, (i) => store.upsertWorktree(i))
    ctx.ipc
      .invoke(AgentStatusIpc.list, undefined)
      .then((l) => store.hydrate(l))
      .catch((e: unknown) => console.warn('agent-status: list failed', e))
    const entry = { id: SLOT_ENTRY_ID, order: SLOT_ORDER }
    ctx.slots.register<WorktreeRowSlotProps>(PROJECTS_SLOTS.worktreeRowLeading, {
      ...entry,
      component: WorktreeRowStatus,
    })
    ctx.slots.register<WorktreeRowSlotProps>(PROJECTS_SLOTS.worktreeRowBadges, {
      ...entry,
      component: WorktreeRowUnread,
    })
    ctx.slots.register<AgentSessionTabBadgesProps>(AGENT_SLOTS.tabBadges, { ...entry, component: SessionTabBadge })
    ctx.slots.register<BoardCardBadgeProps>(BOARD_CARD_BADGES_SLOT, { ...entry, component: BoardCardBadge })
    ctx.slots.register(ShellSlots.statusbarRight, { ...entry, component: StatusbarCounts })
    ctx.settingsPages.register({
      id: SETTINGS_PAGE_ID,
      titleKey: 'agent-status:settings.title',
      order: SETTINGS_PAGE_ORDER.notifications,
      icon: SETTINGS_ICON,
      component: AgentStatusSettingsPage,
    })
  },
})
