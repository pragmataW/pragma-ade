import { AGENT_SLOTS, type AgentSessionToolbarProps } from '@pragma/module-agents/contract'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { TOGGLE_SLOT_ID, TOGGLE_SLOT_ORDER } from '../constants'
import { withSwitchClient } from './switch-client'
import { ViewToggle } from './ViewToggle'

/** `agentSession.toolbar`: the Chat | Terminal toggle (failures and conflicts show inline under it). */
export default defineRendererModule({
  activate(ctx) {
    ctx.slots.register<AgentSessionToolbarProps>(AGENT_SLOTS.toolbar, {
      id: TOGGLE_SLOT_ID,
      order: TOGGLE_SLOT_ORDER,
      component: withSwitchClient(ViewToggle),
    })
  },
})
