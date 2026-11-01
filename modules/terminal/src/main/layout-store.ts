import { randomUUID } from 'node:crypto'
import { HANGUP_SIGNAL } from '@pragma/terminal-pty-daemon/protocol'
import { DEFAULT_COLS, DEFAULT_ROWS } from '../constants'
import {
  MAX_PANES_PER_TAB,
  type PtyExit,
  type PtyService,
  SPLIT,
  type SplitAction,
  TERMINAL_OWNER_PANEL,
  TERMINAL_TAG_OWNER,
  TERMINAL_TAG_WORKTREE,
  type TerminalPane,
  type TerminalTab,
  type WorktreeTerminalLayout,
} from '../contract'

export interface LayoutStoreDeps {
  pty: PtyService
  getWorktreePath: (worktreeId: string) => Promise<string>
  onChange: (layout: WorktreeTerminalLayout) => void
  idGen?: () => string
}

type TabUpdate = (tab: TerminalTab) => TerminalTab | null

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))
const panelTags = (worktreeId: string) => ({
  [TERMINAL_TAG_OWNER]: TERMINAL_OWNER_PANEL,
  [TERMINAL_TAG_WORKTREE]: worktreeId,
})

/** The tab to activate when `index` disappears: the next one, else the previous one. */
const neighbour = (tabs: readonly TerminalTab[], index: number): string | null =>
  (tabs[index + 1] ?? tabs[index - 1])?.id ?? null

/** Per-worktree terminal tabs and binary splits, kept in main so they survive renderer reloads. */
export class TerminalLayoutStore {
  readonly #deps: LayoutStoreDeps
  readonly #idGen: () => string
  readonly #layouts = new Map<string, WorktreeTerminalLayout>()

  constructor(deps: LayoutStoreDeps) {
    this.#deps = deps
    this.#idGen = deps.idGen ?? randomUUID
  }

  get(worktreeId: string): WorktreeTerminalLayout {
    return this.#layouts.get(worktreeId) ?? { worktreeId, tabs: [], activeTabId: null }
  }

  async createTab(worktreeId: string): Promise<WorktreeTerminalLayout> {
    const pane = await this.#spawnPane(worktreeId)
    const current = this.get(worktreeId)
    const ordinal = Math.max(0, ...current.tabs.map((t) => t.ordinal)) + 1
    const tab: TerminalTab = {
      id: this.#idGen(),
      ordinal,
      customTitle: null,
      split: SPLIT.none,
      panes: [pane],
      activePaneId: pane.id,
    }
    return this.#commit({ ...current, tabs: [...current.tabs, tab], activeTabId: tab.id })
  }

  closeTab(worktreeId: string, tabId: string): WorktreeTerminalLayout {
    const current = this.get(worktreeId)
    const index = current.tabs.findIndex((t) => t.id === tabId)
    const tab = current.tabs[index]
    if (!tab) return current
    for (const p of tab.panes) this.#kill(p.ptyId)
    return this.#commit(this.#withoutTab(current, index))
  }

  renameTab(worktreeId: string, tabId: string, title: string): WorktreeTerminalLayout {
    const customTitle = title.trim() || null
    return this.#updateTab(worktreeId, tabId, (t) => ({ ...t, customTitle }))
  }

  activateTab(worktreeId: string, tabId: string): WorktreeTerminalLayout {
    const current = this.get(worktreeId)
    if (!current.tabs.some((t) => t.id === tabId)) return current
    return this.#commit({ ...current, activeTabId: tabId })
  }

  /** Adds the second pane; a tab that is already split is left unchanged. */
  async split(worktreeId: string, tabId: string, direction: SplitAction): Promise<WorktreeTerminalLayout> {
    const tab = this.get(worktreeId).tabs.find((t) => t.id === tabId)
    if (!tab || tab.panes.length >= MAX_PANES_PER_TAB) return this.get(worktreeId)
    const pane = await this.#spawnPane(worktreeId)
    return this.#updateTab(worktreeId, tabId, (t) =>
      t.panes.length >= MAX_PANES_PER_TAB
        ? t
        : { ...t, split: direction, panes: [...t.panes, pane], activePaneId: pane.id },
    )
  }

  /** One pane left: the split collapses; none left: the tab is removed. */
  closePane(worktreeId: string, tabId: string, paneId: string): WorktreeTerminalLayout {
    return this.#updateTab(worktreeId, tabId, (t) => {
      const closing = t.panes.find((p) => p.id === paneId)
      if (!closing) return t
      this.#kill(closing.ptyId)
      const panes = t.panes.filter((p) => p.id !== paneId)
      const first = panes[0]
      return first ? { ...t, split: SPLIT.none, panes, activePaneId: first.id } : null
    })
  }

  /** Kills the worktree's panel ptys (never ptys tagged for other owners) and drops its layout. */
  disposeWorktree(worktreeId: string): void {
    const ids = new Set(this.get(worktreeId).tabs.flatMap((t) => t.panes.map((p) => p.ptyId)))
    for (const info of this.#deps.pty.list({ tags: panelTags(worktreeId) })) ids.add(info.ptyId)
    for (const id of ids) this.#kill(id)
    this.#layouts.delete(worktreeId)
  }

  handleExit(exit: PtyExit): void {
    const { ptyId, ...rest } = exit
    for (const layout of this.#layouts.values()) {
      const tab = layout.tabs.find((t) => t.panes.some((p) => p.ptyId === ptyId))
      if (!tab) continue
      this.#updateTab(layout.worktreeId, tab.id, (t) => ({
        ...t,
        panes: t.panes.map((p) => (p.ptyId === ptyId ? { ...p, exit: rest } : p)),
      }))
      return
    }
  }

  #updateTab(worktreeId: string, tabId: string, update: TabUpdate): WorktreeTerminalLayout {
    const current = this.get(worktreeId)
    const index = current.tabs.findIndex((t) => t.id === tabId)
    const tab = current.tabs[index]
    if (!tab) return current
    const next = update(tab)
    if (next === tab) return current
    if (next === null) return this.#commit(this.#withoutTab(current, index))
    return this.#commit({ ...current, tabs: current.tabs.map((t) => (t.id === tabId ? next : t)) })
  }

  #withoutTab(layout: WorktreeTerminalLayout, index: number): WorktreeTerminalLayout {
    const removed = layout.tabs[index]
    const tabs = layout.tabs.filter((_, i) => i !== index)
    const activeTabId = layout.activeTabId === removed?.id ? neighbour(layout.tabs, index) : layout.activeTabId
    return { ...layout, tabs, activeTabId }
  }

  #commit(layout: WorktreeTerminalLayout): WorktreeTerminalLayout {
    this.#layouts.set(layout.worktreeId, layout)
    this.#deps.onChange(layout)
    return layout
  }

  async #spawnPane(worktreeId: string): Promise<TerminalPane> {
    const id = this.#idGen()
    try {
      const cwd = await this.#deps.getWorktreePath(worktreeId)
      const ptyId = await this.#deps.pty.spawn({
        cwd,
        cols: DEFAULT_COLS,
        rows: DEFAULT_ROWS,
        tags: panelTags(worktreeId),
      })
      return { id, ptyId, exit: null, error: null }
    } catch (error) {
      return { id, ptyId: '', exit: null, error: messageOf(error) }
    }
  }

  #kill(ptyId: string): void {
    if (ptyId) this.#deps.pty.kill(ptyId, HANGUP_SIGNAL).catch(() => undefined)
  }
}
