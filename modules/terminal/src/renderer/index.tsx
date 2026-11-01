import { defineRendererModule } from '@pragma/sdk/renderer'
import { RIGHT_TAB_ICON, RIGHT_TAB_ID, RIGHT_TAB_ORDER } from '../constants'
import { type TerminalSettings, TerminalViewServiceToken } from '../contract'
import { TerminalPanel } from './panel/TerminalPanel'
import { createWorkspace } from './panel/workspace-store'
import { setRuntime } from './runtime'
import { TerminalView } from './view/TerminalView'

export default defineRendererModule<TerminalSettings>({
  activate(ctx) {
    setRuntime({ ctx, workspace: createWorkspace(ctx) })
    ctx.services.provide(TerminalViewServiceToken, { TerminalView })
    ctx.panels.registerRightTab({
      id: RIGHT_TAB_ID,
      titleKey: 'terminal:panel.title',
      icon: RIGHT_TAB_ICON,
      order: RIGHT_TAB_ORDER,
      component: TerminalPanel,
    })
  },
})
