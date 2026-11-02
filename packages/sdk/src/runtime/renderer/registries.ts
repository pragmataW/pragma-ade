import { createStore, type StoreApi } from 'zustand/vanilla'
import { type Disposable, toDisposable } from '../../common/disposable'
import type { CenterView, RightTab, SettingsPage, SlotEntry } from '../../renderer/types'

export class DuplicateRegistrationError extends Error {}

export interface RegistryState {
  tabs: RightTab[]
  badges: Record<string, number>
  activeTab: string | null
  views: CenterView[]
  activeView: string | null
  slots: Record<string, SlotEntry<never>[]>
  settingsPages: SettingsPage[]
}

export interface Registries {
  store: StoreApi<RegistryState>
  registerRightTab(t: RightTab): Disposable
  activateRightTab(id: string): void
  setBadge(tabId: string, count: number | null): void
  registerCenterView(v: CenterView): Disposable
  activateView(id: string): void
  registerSlot<P>(slotId: string, e: SlotEntry<P>): Disposable
  registerSettingsPage(p: SettingsPage): Disposable
}

type Ordered = { id: string; order?: number }
const byOrder = (a: Ordered, b: Ordered): number => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)

function addSorted<T extends Ordered>(list: readonly T[], item: T, what: string): T[] {
  if (list.some((x) => x.id === item.id))
    throw new DuplicateRegistrationError(`${what} "${item.id}" is already registered`)
  return [...list, item].sort(byOrder)
}

/** The `default: true` entry, else the first by order (right tabs and center views). */
const initialOf = (list: readonly { id: string; default?: boolean }[]): string | null =>
  (list.find((x) => x.default) ?? list[0])?.id ?? null
const keepOr = (id: string | null, ids: readonly { id: string }[], fallback: string | null) =>
  id !== null && ids.some((x) => x.id === id) ? id : fallback

/** Renderer UI registries (tabs, badges, views, slots, settings pages) in a zustand store. */
export function createRegistries(): Registries {
  const store = createStore<RegistryState>(() => ({
    tabs: [],
    badges: {},
    activeTab: null,
    views: [],
    activeView: null,
    slots: {},
    settingsPages: [],
  }))
  const set = store.setState
  /** Until the user picks a view, the `default: true` view wins whenever it registers. */
  let viewChosen = false
  /** Likewise the `default: true` tab (else the first by order) is active until one is activated explicitly. */
  let tabChosen = false
  return {
    store,
    registerRightTab(t) {
      set((s) => {
        const tabs = addSorted(s.tabs, t, 'right tab')
        return { tabs, activeTab: tabChosen && s.activeTab ? s.activeTab : initialOf(tabs) }
      })
      return toDisposable(() =>
        set((s) => {
          const tabs = s.tabs.filter((x) => x.id !== t.id)
          const { [t.id]: _removed, ...badges } = s.badges
          return { tabs, badges, activeTab: keepOr(s.activeTab, tabs, initialOf(tabs)) }
        }),
      )
    },
    activateRightTab: (id) => {
      tabChosen = true
      set({ activeTab: id })
    },
    setBadge: (tabId, count) =>
      set((s) => {
        const { [tabId]: _old, ...rest } = s.badges
        return { badges: count === null ? rest : { ...rest, [tabId]: count } }
      }),
    registerCenterView(v) {
      set((s) => {
        const views = addSorted(s.views, v, 'center view')
        return { views, activeView: viewChosen ? s.activeView : initialOf(views) }
      })
      return toDisposable(() =>
        set((s) => {
          const views = s.views.filter((x) => x.id !== v.id)
          return { views, activeView: keepOr(s.activeView, views, initialOf(views)) }
        }),
      )
    },
    activateView: (id) => {
      viewChosen = true
      set({ activeView: id })
    },
    registerSlot(slotId, e) {
      const entry = e as unknown as SlotEntry<never>
      set((s) => ({ slots: { ...s.slots, [slotId]: addSorted(s.slots[slotId] ?? [], entry, `slot ${slotId} entry`) } }))
      return toDisposable(() =>
        set((s) => ({ slots: { ...s.slots, [slotId]: (s.slots[slotId] ?? []).filter((x) => x !== entry) } })),
      )
    },
    registerSettingsPage(p) {
      set((s) => ({ settingsPages: addSorted(s.settingsPages, p, 'settings page') }))
      return toDisposable(() => set((s) => ({ settingsPages: s.settingsPages.filter((x) => x.id !== p.id) })))
    },
  }
}
