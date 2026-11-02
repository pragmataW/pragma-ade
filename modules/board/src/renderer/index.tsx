import { AGENTS_VIEW_ID } from '@pragma/module-agents/contract'
import { projectsIpcEvents } from '@pragma/module-projects/contract'
import { SETTINGS_PAGE_ORDER, ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { SETTINGS_ICON, SIDEBAR_ENTRY_ID, SIDEBAR_ENTRY_ORDER, VIEW_ICON } from '../constants'
import { BOARD_MODULE_ID, BOARD_VIEW_ID, type BoardSettings, boardIpcEvents, boardOpenCommand } from '../contract'
import { BoardSettingsPage } from './components/BoardSettingsPage'
import { BoardView } from './components/BoardView'
import { SidebarBoardEntry } from './components/SidebarBoardEntry'
import { showBoard, showView } from './lib/navigation'
import { setBoardCtx } from './lib/runtime'
import { viewHistory } from './lib/view-history'
import { openBoard, patchSessionStatus, refresh, refreshCount, scopeIncludes, useBoardStore } from './store'
import './board.css'

const warnCount = (e: unknown) => console.warn('board: open count failed', e)
const warnRefresh = (e: unknown) => console.warn('board: refresh failed', e)
const warnLeave = (e: unknown) => console.warn('board: leaving for the selected worktree failed', e)

export default defineRendererModule<BoardSettings>({
  activate(ctx) {
    setBoardCtx(ctx)
    ctx.views.registerCenterView({
      id: BOARD_VIEW_ID,
      titleKey: 'board:view.title',
      icon: VIEW_ICON,
      component: BoardView,
      hideRightPanel: true,
    })
    ctx.slots.register(ShellSlots.sidebarFooter, {
      id: SIDEBAR_ENTRY_ID,
      order: SIDEBAR_ENTRY_ORDER,
      component: SidebarBoardEntry,
    })
    ctx.commands.register(
      boardOpenCommand,
      async (args) => {
        await openBoard(args?.projectId)
        await showBoard()
      },
      { titleKey: 'board:commands.open', palette: true },
    )
    ctx.ipc.subscribe(boardIpcEvents.changed, ({ projectIds }) => {
      if (scopeIncludes(useBoardStore.getState().scope, projectIds)) refresh().catch(warnRefresh)
      refreshCount().catch(warnCount)
    })
    ctx.ipc.subscribe(boardIpcEvents.sessionStatusChanged, patchSessionStatus)
    // A worktree picked in the sidebar while the board is shown: show that worktree (the agents view).
    ctx.ipc.subscribe(projectsIpcEvents.selected, ({ worktreeId }) => {
      if (worktreeId !== null && viewHistory.boardShown()) showView(AGENTS_VIEW_ID).catch(warnLeave)
    })
    ctx.settingsPages.register({
      id: BOARD_MODULE_ID,
      titleKey: 'board:settings.title',
      order: SETTINGS_PAGE_ORDER.board,
      icon: SETTINGS_ICON,
      component: BoardSettingsPage,
    })
    refreshCount().catch(warnCount)
  },
})
