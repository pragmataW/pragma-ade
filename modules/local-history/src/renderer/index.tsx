import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { defineRendererModule, type RendererContext } from '@pragma/sdk/renderer'
import {
  COMMANDS,
  SETTINGS_ORDER,
  SETTINGS_PAGE_ICON,
  SETTINGS_PAGE_ID,
  TAB_ICON,
  TAB_ID,
  TAB_ORDER,
} from '../constants'
import { LocalHistoryIpc, type LocalHistorySettings } from '../contract'
import { LocalHistorySettingsPage } from './LocalHistorySettingsPage'
import { LocalHistoryTab } from './LocalHistoryTab'
import { confirmRestore, reportRestore } from './restore'

/** Restores the newest entry of the active worktree that is not itself a restore and has not been restored yet. */
async function restoreLatest(ctx: RendererContext<LocalHistorySettings>): Promise<void> {
  const active = ctx.services.tryGet(ProjectsRendererServiceToken)?.getActiveWorktree()
  ctx.panels.activateRightTab(TAB_ID)
  if (!active) return
  const latest = (await ctx.ipc.invoke(LocalHistoryIpc.list, { worktreeId: active.id })).find(
    (e) => e.reason !== 'restore' && e.restoredAt === null,
  )
  if (!latest || !(await confirmRestore(ctx, latest))) return
  reportRestore(ctx, await ctx.ipc.invoke(LocalHistoryIpc.restore, { id: latest.id }))
}

export default defineRendererModule<LocalHistorySettings>({
  activate(ctx) {
    ctx.panels.registerRightTab({
      id: TAB_ID,
      titleKey: 'local-history:tab.title',
      icon: TAB_ICON,
      order: TAB_ORDER,
      component: LocalHistoryTab,
    })
    ctx.settingsPages.register({
      id: SETTINGS_PAGE_ID,
      titleKey: 'local-history:settings.title',
      order: SETTINGS_ORDER,
      icon: SETTINGS_PAGE_ICON,
      component: LocalHistorySettingsPage,
    })
    ctx.commands.register(COMMANDS.show, () => ctx.panels.activateRightTab(TAB_ID), {
      titleKey: 'local-history:commands.show',
      palette: true,
    })
    ctx.commands.register(COMMANDS.restoreLatest, () => restoreLatest(ctx), {
      titleKey: 'local-history:commands.restoreLatest',
      palette: true,
    })
  },
})
