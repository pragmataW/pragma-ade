import { ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { SIDEBAR_ENTRY_ID, SIDEBAR_ENTRY_ORDER, VIEW_ICON } from '../constants'
import { BOARD_VIEW_ID, type BoardSettings, boardIpcEvents, boardOpenCommand } from '../contract'
import { BoardView } from './components/BoardView'
import { SidebarBoardEntry } from './components/SidebarBoardEntry'
import { showBoard } from './lib/navigation'
import { setBoardCtx } from './lib/runtime'
import { openBoard, patchSessionStatus, refresh, refreshCount, scopeIncludes, useBoardStore } from './store'
import './board.css'

const warnCount = (e: unknown) => console.warn('board: open count failed', e)
const warnRefresh = (e: unknown) => console.warn('board: refresh failed', e)

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
    refreshCount().catch(warnCount)
  },
})
