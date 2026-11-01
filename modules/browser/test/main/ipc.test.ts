import { worktreeRemoved, worktreeSelected } from '@pragma/module-projects/contract'
import { CoreCommands } from '@pragma/sdk'
import { describe, expect, it, vi } from 'vitest'
import { BROWSER_COMMANDS, BrowserIpc } from '../../src/contract'
import { registerBrowserIpc, runShortcut } from '../../src/main/ipc'
import { fakeMainCtx, flush, setupManager } from '../lib/builders'

function setup(opts: { comments?: boolean } = {}) {
  const m = setupManager()
  const picker = { start: vi.fn(async () => undefined), cancel: vi.fn(), dismiss: vi.fn() }
  const c = fakeMainCtx(opts)
  registerBrowserIpc(c.ctx, m.manager, picker)
  return { ...m, ...c, picker }
}

describe('browser ipc', () => {
  it('navigate normalizes the input', async () => {
    const { manager, invoke } = setup()
    const tabId = manager.openTab('wtA')
    expect(await invoke(BrowserIpc.navigate, { tabId, input: '3000' })).toEqual({ url: 'http://localhost:3000/' })
  })

  it('an unknown tab rejects with tabNotFound', async () => {
    const { invoke } = setup()
    await expect(invoke(BrowserIpc.closeTab, { tabId: 'nope' })).rejects.toMatchObject({ code: 'tabNotFound' })
  })

  it('worktree events drive the manager', async () => {
    const { manager, ctx, host } = setup()
    const spy = vi.spyOn(manager, 'setActiveWorktree')
    ctx.events.emit(worktreeSelected, { worktreeId: 'wtB', previousWorktreeId: null })
    expect(spy).toHaveBeenCalledWith('wtB')
    manager.openTab('wtB')
    ctx.events.emit(worktreeRemoved, { worktreeId: 'wtB', projectId: 'p', path: '/x', reason: 'user' })
    await flush()
    expect(host.calls).toContain('clearPartition:persist:wt-wtB')
    expect(manager.snapshot().worktrees.wtB).toBeUndefined()
  })

  it('browser.open with no worktree and no active worktree → noWorktree', async () => {
    const { ctx } = setup()
    await expect(ctx.commands.execute(BROWSER_COMMANDS.open, { url: 'http://localhost:1/' })).rejects.toMatchObject({
      code: 'noWorktree',
    })
  })

  it('browser.open opens in the active worktree and reveals the panel', async () => {
    const { ctx, manager, executed } = setup()
    manager.setActiveWorktree('wtA')
    await ctx.commands.execute(BROWSER_COMMANDS.open, { url: 'http://localhost:1/' })
    expect(manager.snapshot().worktrees.wtA?.tabIds).toHaveLength(1)
    expect(executed).toContainEqual({ id: CoreCommands.activateRightTab, args: { id: 'browser' } })
  })

  it('openTab and the tab handlers round-trip', async () => {
    const { invoke, manager } = setup()
    manager.setActiveWorktree('wtA')
    const { tabId } = await invoke(BrowserIpc.openTab, {})
    expect(await invoke(BrowserIpc.zoom, { tabId, action: 'in' })).toEqual({ zoomFactor: 1.1 })
    expect(await invoke(BrowserIpc.toggleDevTools, { tabId })).toEqual({ open: true })
    await invoke(BrowserIpc.history, { tabId, action: 'reload' })
    await invoke(BrowserIpc.activateTab, { tabId })
    expect((await invoke(BrowserIpc.getSnapshot, {})).worktrees.wtA?.activeTabId).toBe(tabId)
  })

  it.each([
    [true, 1],
    [false, 0],
  ])('togglePicker with comments=%s starts the picker %s time(s)', async (comments, calls) => {
    const { ctx, manager, picker } = setup({ comments })
    manager.setActiveWorktree('wtA')
    manager.openTab('wtA')
    await ctx.commands.execute(BROWSER_COMMANDS.togglePicker)
    expect(picker.start).toHaveBeenCalledTimes(calls)
  })

  it('togglePicker cancels an armed tab; picker ipc reaches the picker', async () => {
    const { ctx, manager, picker, invoke } = setup()
    manager.setActiveWorktree('wtA')
    const tabId = manager.openTab('wtA')
    manager.setPickerArmed(tabId)
    await ctx.commands.execute(BROWSER_COMMANDS.togglePicker)
    expect(picker.cancel).toHaveBeenCalledWith(tabId)
    await invoke(BrowserIpc.pickerStart, { tabId })
    await invoke(BrowserIpc.pickDismiss, { pickId: 'p' })
    expect(picker.start).toHaveBeenCalledWith(tabId)
    expect(picker.dismiss).toHaveBeenCalledWith('p')
  })

  it('focusAddress shortcut publishes focusAddressBar', async () => {
    const { ctx, manager, picker, published } = setup()
    const tabId = manager.openTab('wtA')
    runShortcut(ctx, { manager, picker }, tabId, 'focusAddress')
    await flush()
    expect(published).toContainEqual({ channel: BrowserIpc.focusAddressBar.channel, payload: { tabId } })
  })
})
