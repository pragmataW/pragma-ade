import { ShellSlots } from '@pragma/sdk'
import { defineRendererModule } from '@pragma/sdk/renderer'
import { PROBE_COMMANDS, PROBE_ID, PROBE_SLOT_ID, PROBE_TAB_ICON, PROBE_TAB_ORDER, PROBE_VIEW_ID } from '../constants'
import { ProbeIpc } from '../contract'
import { ProbeSlot } from './ProbeSlot'
import { ProbeTab } from './ProbeTab'
import { createPopoverStore } from './popover-store'

export default defineRendererModule({
  activate(ctx) {
    const popover = createPopoverStore()
    ctx.panels.registerRightTab({
      id: PROBE_ID,
      titleKey: 'probe:tab.title',
      icon: PROBE_TAB_ICON,
      order: PROBE_TAB_ORDER,
      component: () => <ProbeTab popover={popover} />,
    })
    ctx.slots.register(ShellSlots.titlebarRight, { id: PROBE_SLOT_ID, order: PROBE_TAB_ORDER, component: ProbeSlot })
    ctx.ipc.subscribe(ProbeIpc.tick, ({ count }) => ctx.panels.setBadge(PROBE_ID, count))
    void ctx.ipc.invoke(ProbeIpc.requestTick, undefined)
    if (!ctx.testMode) return
    ctx.commands.register(PROBE_COMMANDS.openSnapshotPopover, () => popover.set(true))
    ctx.commands.register(PROBE_COMMANDS.freeze, () => ctx.nativeViews.freeze(PROBE_VIEW_ID))
    ctx.commands.register(PROBE_COMMANDS.unfreeze, () => ctx.nativeViews.unfreeze(PROBE_VIEW_ID))
  },
})
