import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
  type Comment,
  commentsIpc,
  commentsIpcEvents,
  type DrawerTab,
  type OpenDrawerArgs,
  SEND_STATUS,
  type SendErrorKey,
  type SendResult,
  type TargetSession,
} from '../contract'
import { runtime } from './runtime'

const DRAFTS_TAB: DrawerTab = 'drafts'

export interface CommentsState {
  activeWorktreeId: string | null
  drafts: Comment[]
  sent: Comment[]
  drawer: { open: boolean; tab: DrawerTab; preferredSessionId?: string }
  selection: ReadonlySet<string>
  targetPicker: { commentIds: string[]; sessions: TargetSession[]; defaultSessionId: string } | null
  launchSuggestion: { worktreeId: string; commentIds: string[]; waiting: boolean } | null
  lastError: SendErrorKey | null
  /** Subscribes to the projects renderer service and the comments events; returns dispose. */
  init(): () => void
  reload(): Promise<void>
  openDrawer(args?: OpenDrawerArgs): void
  closeDrawer(): void
  setTab(tab: DrawerTab): void
  toggleSelected(id: string): void
  clearSelection(): void
  closeTargetPicker(): void
  closeLaunchSuggestion(): void
  setLaunchWaiting(): void
  /** Opens the drawer with an error (a composer's "Send now" failed). */
  showError(key: SendErrorKey): void
  /** The single place mapping a SendResult onto the state. */
  applyResult(worktreeId: string | null, commentIds: string[], r: SendResult): void
}

const EMPTY: ReadonlySet<string> = new Set()

const warn = (what: string) => (e: unknown) => console.warn(`comments: ${what} failed`, e)
const reloadFailed = warn('reload')

export const useCommentsStore: UseBoundStore<StoreApi<CommentsState>> = create<CommentsState>()((set, get) => ({
  activeWorktreeId: null,
  drafts: [],
  sent: [],
  drawer: { open: false, tab: DRAFTS_TAB },
  selection: EMPTY,
  targetPicker: null,
  launchSuggestion: null,
  lastError: null,

  init() {
    const rt = runtime()
    const projects = rt.services.get(ProjectsRendererServiceToken)
    const syncActive = () => {
      const id = projects.getActiveWorktree()?.id ?? null
      if (id === get().activeWorktreeId) return
      set({ activeWorktreeId: id, selection: EMPTY, drafts: [], sent: [], lastError: null })
      get().reload().catch(reloadFailed)
    }
    const offProjects = projects.subscribe(syncActive)
    const subs = [
      rt.ipc.subscribe(commentsIpcEvents.changed, ({ worktreeId }) => {
        if (worktreeId === get().activeWorktreeId) get().reload().catch(reloadFailed)
      }),
      rt.ipc.subscribe(commentsIpcEvents.sendRequested, ({ worktreeId, commentIds, result }) => {
        get().openDrawer({ worktreeId })
        get().applyResult(worktreeId, commentIds, result)
      }),
      rt.ipc.subscribe(commentsIpcEvents.pendingDelivered, ({ worktreeId, result }) => {
        set({ launchSuggestion: null })
        get().applyResult(worktreeId, [], result)
      }),
    ]
    syncActive()
    return () => {
      offProjects()
      for (const s of subs) s.dispose()
    }
  },

  async reload() {
    const worktreeId = get().activeWorktreeId
    if (!worktreeId) return
    const { ipc } = runtime()
    const [drafts, sent] = await Promise.all([
      ipc.invoke(commentsIpc.listDrafts, { worktreeId }),
      ipc.invoke(commentsIpc.listSent, { worktreeId }),
    ])
    if (get().activeWorktreeId !== worktreeId) return
    const ids = new Set(drafts.map((c) => c.id))
    set((s) => ({ drafts, sent, selection: new Set([...s.selection].filter((id) => ids.has(id))) }))
  },

  openDrawer(args = {}) {
    set({
      drawer: { open: true, tab: args.tab ?? DRAFTS_TAB, preferredSessionId: args.preferredSessionId },
      lastError: null,
    })
  },
  closeDrawer: () => set((s) => ({ drawer: { ...s.drawer, open: false } })),
  setTab: (tab) => set((s) => ({ drawer: { ...s.drawer, tab } })),
  toggleSelected(id) {
    const next = new Set(get().selection)
    if (!next.delete(id)) next.add(id)
    set({ selection: next })
  },
  clearSelection: () => set({ selection: EMPTY }),
  closeTargetPicker: () => set({ targetPicker: null }),
  closeLaunchSuggestion: () => set({ launchSuggestion: null }),
  setLaunchWaiting: () =>
    set((s) => (s.launchSuggestion ? { launchSuggestion: { ...s.launchSuggestion, waiting: true } } : s)),

  showError(key) {
    get().openDrawer()
    set({ lastError: key })
  },

  applyResult(worktreeId, commentIds, r) {
    switch (r.status) {
      case SEND_STATUS.sent:
        set({ lastError: null, targetPicker: null, launchSuggestion: null, selection: EMPTY })
        return
      case SEND_STATUS.needsTarget:
        set({
          lastError: null,
          targetPicker: { commentIds, sessions: r.sessions, defaultSessionId: r.defaultSessionId },
        })
        return
      case SEND_STATUS.noSession:
        set({
          lastError: null,
          launchSuggestion: worktreeId ? { worktreeId, commentIds, waiting: false } : null,
        })
        return
      case SEND_STATUS.failed:
        set({ lastError: r.errorKey, targetPicker: null })
        return
      default: {
        const never: never = r
        throw new Error(`unknown send result ${JSON.stringify(never)}`)
      }
    }
  },
}))
