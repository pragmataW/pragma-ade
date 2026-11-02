import { AGENTS_VIEW_ID } from '@pragma/module-agents/contract'
import { BOARD_VIEW_ID } from '../../contract'

/** The slice of the shell's view registry the board reads (`useRendererHost().registries.store`). */
export interface ViewRegistryState {
  activeView: string | null
  views: readonly { id: string }[]
}

export interface ViewRegistryStore {
  getState(): ViewRegistryState
  subscribe(listener: (state: ViewRegistryState, prev: ViewRegistryState) => void): () => void
}

/**
 * Remembers the center view that was shown when the board opened, so Back returns there. It watches the shell's
 * view registry (subscribed once per store, from the always-mounted sidebar entry and from the board view).
 */
export function createViewHistory() {
  let store: ViewRegistryStore | null = null
  let stop: (() => void) | null = null
  let previous: string | null = null
  const registered = (id: string | null): id is string =>
    id !== null && (store?.getState().views.some((v) => v.id === id) ?? false)
  return {
    track(next: ViewRegistryStore): void {
      if (store === next) return
      stop?.()
      store = next
      stop = next.subscribe((s, prev) => {
        if (s.activeView === BOARD_VIEW_ID && prev.activeView !== BOARD_VIEW_ID) previous = prev.activeView
      })
    },
    /** True while the board is the active center view. */
    boardShown: (): boolean => store?.getState().activeView === BOARD_VIEW_ID,
    /** Back's target: the view shown before the board while it is still registered, else the agents view. */
    backTarget: (): string => (previous !== BOARD_VIEW_ID && registered(previous) ? previous : AGENTS_VIEW_ID),
    dispose(): void {
      stop?.()
      store = null
      stop = null
      previous = null
    },
  }
}

export type ViewHistory = ReturnType<typeof createViewHistory>

/** The renderer's one history (the shell has one view registry). */
export const viewHistory = createViewHistory()
