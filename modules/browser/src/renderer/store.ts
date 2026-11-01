import type { RendererContext } from '@pragma/sdk/renderer'
import { createStore, type StoreApi } from 'zustand/vanilla'
import { BrowserIpc, type BrowserPick, type BrowserSnapshot, type BrowserTabState } from '../contract'

type Ipc = RendererContext['ipc']

export interface BrowserState {
  snapshot: BrowserSnapshot | null
  pick: BrowserPick | null
  /** Bumped when the address bar of the active tab should take focus. */
  addressFocusTick: number
  applySnapshot(s: BrowserSnapshot): void
  setPick(p: BrowserPick): void
  clearPick(): void
  focusAddress(tabId: string): void
}

export type BrowserStore = StoreApi<BrowserState> & { dispose(): void }

/** The active worktree's tabs, in strip order. */
export function activeTabs(s: Pick<BrowserState, 'snapshot'>): BrowserTabState[] {
  const snap = s.snapshot
  const wt = snap?.activeWorktreeId ? snap.worktrees[snap.activeWorktreeId] : undefined
  return (wt?.tabIds ?? []).flatMap((id) => (snap?.tabs[id] ? [snap.tabs[id]] : []))
}

/** The active worktree's active tab. */
export function activeTab(s: Pick<BrowserState, 'snapshot'>): BrowserTabState | null {
  const snap = s.snapshot
  const id = snap?.activeWorktreeId ? snap.worktrees[snap.activeWorktreeId]?.activeTabId : null
  return (id && snap?.tabs[id]) || null
}

/** Snapshot, pick and focus state over the browser IPC events; loads the snapshot once. */
export function createBrowserStore(ipc: Ipc): BrowserStore {
  const store = createStore<BrowserState>((set, get) => ({
    snapshot: null,
    pick: null,
    addressFocusTick: 0,
    applySnapshot(snapshot) {
      const pick = get().pick
      set({ snapshot, pick: pick && snapshot.tabs[pick.tabId] ? pick : null })
    },
    setPick: (pick) => set({ pick }),
    clearPick: () => set({ pick: null }),
    focusAddress(tabId) {
      if (activeTab(get())?.id === tabId) set((s) => ({ addressFocusTick: s.addressFocusTick + 1 }))
    },
  }))
  const s = store.getState
  const subs = [
    ipc.subscribe(BrowserIpc.snapshot, (snap) => s().applySnapshot(snap)),
    ipc.subscribe(BrowserIpc.picked, (pick) => s().setPick(pick)),
    ipc.subscribe(BrowserIpc.pickCancelled, ({ tabId }) => {
      if (s().pick?.tabId === tabId) s().clearPick()
    }),
    ipc.subscribe(BrowserIpc.focusAddressBar, ({ tabId }) => s().focusAddress(tabId)),
  ]
  ipc
    .invoke(BrowserIpc.getSnapshot, {})
    .then((snap) => {
      if (!s().snapshot) s().applySnapshot(snap)
    })
    .catch(() => undefined)
  return Object.assign(store, {
    dispose() {
      for (const d of subs) d.dispose()
    },
  })
}
