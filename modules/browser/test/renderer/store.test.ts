import { describe, expect, it } from 'vitest'
import { BrowserIpc } from '../../src/contract'
import { activeTab, activeTabs, createBrowserStore } from '../../src/renderer/store'
import { buildPick, buildSnapshot, buildTab } from '../lib/builders'

function setup() {
  const listeners = new Map<string, (p: unknown) => void>()
  const ipc = {
    invoke: async () => buildSnapshot(),
    subscribe: (c: { channel: string }, cb: (p: unknown) => void) => {
      listeners.set(c.channel, cb)
      return { dispose: () => listeners.delete(c.channel) }
    },
  }
  const store = createBrowserStore(ipc as never)
  const emit = (c: { channel: string }, p: unknown) => listeners.get(c.channel)?.(p)
  return { store, emit, listeners }
}

const a1 = buildTab({ id: 'a1' })
const a2 = buildTab({ id: 'a2' })
const b1 = buildTab({ id: 'b1', worktreeId: 'wtB' })

describe('browser store', () => {
  it.each([
    ['active worktree A', buildSnapshot([a1, a2, b1]), ['a1', 'a2'], 'a2'],
    ['active worktree B', buildSnapshot([a1, a2, b1], { activeWorktreeId: 'wtB' }), ['b1'], 'b1'],
    ['no worktree', buildSnapshot([a1], { activeWorktreeId: null }), [], null],
    ['worktree without tabs', buildSnapshot([a1], { activeWorktreeId: 'wtC' }), [], null],
  ])('%s', (_, snapshot, ids, active) => {
    const { store } = setup()
    store.getState().applySnapshot(snapshot)
    expect(activeTabs(store.getState()).map((t) => t.id)).toEqual(ids)
    expect(activeTab(store.getState())?.id ?? null).toBe(active)
  })

  it.each([
    [
      'a pickCancelled for the pick tab',
      (e: ReturnType<typeof setup>['emit']) => e(BrowserIpc.pickCancelled, { tabId: 't1', reason: 'user' }),
      null,
    ],
    [
      'a pickCancelled for another tab',
      (e: ReturnType<typeof setup>['emit']) => e(BrowserIpc.pickCancelled, { tabId: 'x', reason: 'user' }),
      'p1',
    ],
    [
      'a snapshot without the pick tab',
      (e: ReturnType<typeof setup>['emit']) => e(BrowserIpc.snapshot, buildSnapshot([a1])),
      null,
    ],
    [
      'a snapshot with the pick tab',
      (e: ReturnType<typeof setup>['emit']) => e(BrowserIpc.snapshot, buildSnapshot()),
      'p1',
    ],
  ])('%s', (_, act, expected) => {
    const { store, emit } = setup()
    emit(BrowserIpc.picked, buildPick())
    act(emit)
    expect(store.getState().pick?.pickId ?? null).toBe(expected)
  })

  it('focusAddressBar bumps the tick only for the active tab', () => {
    const { store, emit } = setup()
    store.getState().applySnapshot(buildSnapshot())
    emit(BrowserIpc.focusAddressBar, { tabId: 'other' })
    emit(BrowserIpc.focusAddressBar, { tabId: 't1' })
    expect(store.getState().addressFocusTick).toBe(1)
  })

  it('dispose unsubscribes', () => {
    const { store, listeners } = setup()
    store.dispose()
    expect(listeners.size).toBe(0)
  })
})
