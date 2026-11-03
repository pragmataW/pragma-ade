import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { create, type StoreApi, type UseBoundStore } from 'zustand'
import {
  type Comment,
  commentsIpc,
  commentsIpcEvents,
  type OpenDrawerArgs,
  pendingCount,
  SEND_STATUS,
  type SendErrorKey,
  type SendResult,
  type TargetSession,
} from '../contract'
import { runtime } from './runtime'

export interface CommentsState {
  activeWorktreeId: string | null
  /** The active worktree's review threads (every status) with their replies, oldest first. */
  threads: Comment[]
  /** The active worktree's last delivered review round (0 before the first). */
  round: number
  drawer: { open: boolean; preferredSessionId?: string }
  /** Send reaches several agents: the user picks one; Send then delivers the worktree's round to it. */
  targetPicker: { worktreeId: string; sessions: TargetSession[]; defaultSessionId: string } | null
  /** No agent runs: offer to start one; `count` pending items wait for it. */
  launchSuggestion: { worktreeId: string; count: number; waiting: boolean } | null
  lastError: SendErrorKey | null
  /** Subscribes to the projects renderer service and the comments events; returns dispose. */
  init(): () => void
  reload(): Promise<void>
  openDrawer(args?: OpenDrawerArgs): void
  closeDrawer(): void
  closeTargetPicker(): void
  closeLaunchSuggestion(): void
  setLaunchWaiting(): void
  /** Opens the drawer with an error (a composer's "Send now" failed). */
  showError(key: SendErrorKey): void
  /** The single place mapping a SendResult onto the state. */
  applyResult(worktreeId: string | null, r: SendResult): void
}

/** What the next Send delivers in the active worktree: new roots + user replies not sent yet. */
export const selectPending = (s: Pick<CommentsState, 'threads'>): number => pendingCount(s.threads)

const warn = (what: string) => (e: unknown) => console.warn(`comments: ${what} failed`, e)
const reloadFailed = warn('reload')

export const useCommentsStore: UseBoundStore<StoreApi<CommentsState>> = create<CommentsState>()((set, get) => ({
  activeWorktreeId: null,
  threads: [],
  round: 0,
  drawer: { open: false },
  targetPicker: null,
  launchSuggestion: null,
  lastError: null,

  init() {
    const rt = runtime()
    const projects = rt.services.get(ProjectsRendererServiceToken)
    const syncActive = () => {
      const id = projects.getActiveWorktree()?.id ?? null
      if (id === get().activeWorktreeId) return
      set({ activeWorktreeId: id, threads: [], round: 0, lastError: null })
      get().reload().catch(reloadFailed)
    }
    const offProjects = projects.subscribe(syncActive)
    const subs = [
      rt.ipc.subscribe(commentsIpcEvents.changed, ({ worktreeId }) => {
        if (worktreeId === get().activeWorktreeId) get().reload().catch(reloadFailed)
      }),
      rt.ipc.subscribe(commentsIpcEvents.sendRequested, ({ worktreeId, result }) => {
        get().openDrawer({ worktreeId })
        get().applyResult(worktreeId, result)
      }),
      rt.ipc.subscribe(commentsIpcEvents.pendingDelivered, ({ worktreeId, result }) => {
        set({ launchSuggestion: null })
        get().applyResult(worktreeId, result)
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
    const { threads, round } = await ipc.invoke(commentsIpc.list, { worktreeId })
    if (get().activeWorktreeId !== worktreeId) return
    set({ threads, round })
  },

  openDrawer(args = {}) {
    set({ drawer: { open: true, preferredSessionId: args.preferredSessionId }, lastError: null })
  },
  closeDrawer: () => set((s) => ({ drawer: { ...s.drawer, open: false } })),
  closeTargetPicker: () => set({ targetPicker: null }),
  closeLaunchSuggestion: () => set({ launchSuggestion: null }),
  setLaunchWaiting: () =>
    set((s) => (s.launchSuggestion ? { launchSuggestion: { ...s.launchSuggestion, waiting: true } } : s)),

  showError(key) {
    get().openDrawer()
    set({ lastError: key })
  },

  applyResult(worktreeId, r) {
    switch (r.status) {
      case SEND_STATUS.sent:
        set({ lastError: null, targetPicker: null, launchSuggestion: null })
        return
      case SEND_STATUS.needsTarget:
        set({
          lastError: null,
          targetPicker: worktreeId ? { worktreeId, sessions: r.sessions, defaultSessionId: r.defaultSessionId } : null,
        })
        return
      case SEND_STATUS.noSession: {
        const count = worktreeId === get().activeWorktreeId ? selectPending(get()) : 0
        set({ lastError: null, launchSuggestion: worktreeId ? { worktreeId, count, waiting: false } : null })
        return
      }
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
