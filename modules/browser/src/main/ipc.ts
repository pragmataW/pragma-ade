import { CommentsServiceToken } from '@pragma/module-comments/contract'
import { worktreeRemoved, worktreeSelected } from '@pragma/module-projects/contract'
import { CoreCommands } from '@pragma/sdk'
import type { MainContext } from '@pragma/sdk/main'
import { RIGHT_TAB_ID } from '../constants'
import { BROWSER_ERROR_CODE, BrowserError, BrowserIpc, browserCommands, HISTORY_ACTION, ZOOM_ACTION } from '../contract'
import type { PickerControl } from './picker-control'
import type { ShortcutAction } from './shortcuts'
import type { BrowserTabManager } from './tab-manager'

const OK = {} as const

/** The tab to open in: the given worktree, else the active one. */
function worktreeFor(manager: BrowserTabManager, worktreeId: string | undefined): string {
  const id = worktreeId ?? manager.activeWorktreeId
  if (!id) throw new BrowserError(BROWSER_ERROR_CODE.noWorktree, 'no worktree is selected')
  return id
}

function registerTabIpc(ctx: MainContext, manager: BrowserTabManager): void {
  ctx.ipc.handle(BrowserIpc.getSnapshot, () => manager.snapshot())
  ctx.ipc.handle(BrowserIpc.openTab, ({ worktreeId, url }) => ({
    tabId: manager.openTab(worktreeFor(manager, worktreeId), url),
  }))
  ctx.ipc.handle(BrowserIpc.closeTab, ({ tabId }) => {
    manager.closeTab(tabId)
    return OK
  })
  ctx.ipc.handle(BrowserIpc.activateTab, ({ tabId }) => {
    manager.activateTab(tabId)
    return OK
  })
  ctx.ipc.handle(BrowserIpc.navigate, ({ tabId, input }) => ({ url: manager.navigate(tabId, input) }))
  ctx.ipc.handle(BrowserIpc.history, ({ tabId, action }) => {
    manager.history(tabId, action)
    return OK
  })
  ctx.ipc.handle(BrowserIpc.toggleDevTools, ({ tabId }) => ({ open: manager.toggleDevTools(tabId) }))
  ctx.ipc.handle(BrowserIpc.zoom, ({ tabId, action }) => ({ zoomFactor: manager.zoom(tabId, action) }))
}

function registerPickerIpc(ctx: MainContext, picker: PickerControl): void {
  ctx.ipc.handle(BrowserIpc.pickerStart, async ({ tabId }) => {
    await picker.start(tabId)
    return OK
  })
  ctx.ipc.handle(BrowserIpc.pickerCancel, ({ tabId }) => {
    picker.cancel(tabId)
    return OK
  })
  ctx.ipc.handle(BrowserIpc.pickDismiss, ({ pickId }) => {
    picker.dismiss(pickId)
    return OK
  })
}

/** Picking needs the comments pipeline (optional dependency); without it the toggle does nothing. */
export const pickerAvailable = (ctx: MainContext): boolean => ctx.services.tryGet(CommentsServiceToken) !== undefined

/** Starts or cancels the picker on the active tab. */
export async function togglePicker(ctx: MainContext, manager: BrowserTabManager, picker: PickerControl) {
  const tabId = manager.activeTabId()
  if (!tabId || !pickerAvailable(ctx)) return
  if (manager.snapshot().pickerArmedTabId === tabId) picker.cancel(tabId)
  else await picker.start(tabId)
}

/** IPC handlers, the `browser.*` commands and the projects events. */
export function registerBrowserIpc(ctx: MainContext, manager: BrowserTabManager, picker: PickerControl): void {
  registerTabIpc(ctx, manager)
  registerPickerIpc(ctx, picker)
  ctx.commands.register(browserCommands.open, async ({ worktreeId, url }) => {
    const tabId = manager.openTab(worktreeFor(manager, worktreeId), url)
    await ctx.commands.execute(CoreCommands.activateRightTab, { id: RIGHT_TAB_ID }).catch(() => undefined)
    return { tabId }
  })
  ctx.commands.register(browserCommands.togglePicker, () => togglePicker(ctx, manager, picker), {
    titleKey: 'browser:commands.togglePicker',
    palette: true,
  })
  ctx.events.on(worktreeSelected, (p) => manager.setActiveWorktree(p.worktreeId))
  ctx.events.on(worktreeRemoved, (p) => {
    manager.removeWorktree(p.worktreeId).catch((error: unknown) => ctx.log.warn('clearing the partition failed', error))
  })
}

/** What a shortcut typed inside a guest page does. */
export function runShortcut(
  ctx: MainContext,
  deps: { manager: BrowserTabManager; picker: PickerControl },
  tabId: string,
  action: ShortcutAction,
): void {
  const { manager } = deps
  const run: Record<ShortcutAction, () => unknown> = {
    togglePicker: () => togglePicker(ctx, manager, deps.picker),
    focusAddress: () => ctx.ipc.publish(BrowserIpc.focusAddressBar, { tabId }),
    reload: () => manager.history(tabId, HISTORY_ACTION.reload),
    devtools: () => manager.toggleDevTools(tabId),
    zoomIn: () => manager.zoom(tabId, ZOOM_ACTION.in),
    zoomOut: () => manager.zoom(tabId, ZOOM_ACTION.out),
    zoomReset: () => manager.zoom(tabId, ZOOM_ACTION.reset),
  }
  Promise.resolve()
    .then(run[action])
    .catch((error: unknown) => ctx.log.warn(`browser shortcut ${action} failed`, error))
}
