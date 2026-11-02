import type { MainContext } from '@pragma/sdk/main'
import type { WebContentsView } from 'electron'
import { VIEW_ID_PREFIX } from '../../constants'
import { FILES_TAB_ID, normalizeFolderKey } from '../../contract'
import type { WorktreeRef } from '../upstream'
import { Lru } from './lru'

/** The part of a `WebContentsView` the manager uses (tests pass fakes). */
export interface EditorViewLike {
  webContents: { id: number; loadURL(url: string): Promise<void>; close(): void; isDestroyed?(): boolean }
}

type NativeViews = Pick<MainContext['nativeViews'], 'attach' | 'detach' | 'show' | 'hide'>

interface Entry {
  view: EditorViewLike
  worktree: WorktreeRef
  folderKey: string
  loaded: string | undefined
  shown: boolean
}

export interface ViewManagerOptions {
  nativeViews: NativeViews
  createView(): EditorViewLike
  /** undefined while the server is not ready. */
  url(folderPath: string): string | undefined
  maxViews: () => number
  onViewCreated(worktreeId: string, view: EditorViewLike): void
  log?: (msg: string) => void
}

const viewId = (worktreeId: string): string => `${VIEW_ID_PREFIX}${worktreeId}`

/** One workbench `WebContentsView` per worktree in the Files tab, at most `maxViews` alive (LRU); the only `nativeViews` user. */
export class ViewManager {
  readonly #o: ViewManagerOptions
  readonly #entries = new Map<string, Entry>()
  readonly #lru: Lru<string>

  constructor(o: ViewManagerOptions) {
    this.#o = o
    this.#lru = new Lru(o.maxViews())
  }

  show(worktree: WorktreeRef, opts: { visible?: boolean } = {}): void {
    const visible = opts.visible ?? true
    const existing = this.#entries.get(worktree.id)
    const entry = existing ?? this.#create(worktree)
    this.#load(entry)
    if (visible) {
      for (const e of this.#entries.values()) e.shown = e === entry
      this.#o.nativeViews.show(viewId(worktree.id))
    } else if (!existing) {
      entry.shown = false
      this.#o.nativeViews.hide(viewId(worktree.id))
    }
    for (const evicted of this.#lru.touch(worktree.id)) this.destroy(evicted)
  }

  hideAll(): void {
    for (const [id, e] of this.#entries) {
      e.shown = false
      this.#o.nativeViews.hide(viewId(id))
    }
  }

  destroy(worktreeId: string): void {
    const e = this.#entries.get(worktreeId)
    if (!e) return
    this.#entries.delete(worktreeId)
    this.#lru.delete(worktreeId)
    this.#o.nativeViews.detach(viewId(worktreeId))
    if (!e.view.webContents.isDestroyed?.()) e.view.webContents.close()
  }

  destroyAll(): void {
    for (const id of [...this.#entries.keys()]) this.destroy(id)
  }

  /** After a server (re)start: every live view loads the new URL (new token). */
  reloadAll(): void {
    for (const e of this.#entries.values()) {
      e.loaded = undefined
      this.#load(e)
    }
  }

  folderKeyToWorktree(key: string): string | undefined {
    for (const [id, e] of this.#entries) if (e.folderKey === key) return id
    return undefined
  }

  openViews(): { worktreeId: string; webContentsId: number; shown: boolean }[] {
    return this.#lru.keys().flatMap((id) => {
      const e = this.#entries.get(id)
      return e ? [{ worktreeId: id, webContentsId: e.view.webContents.id, shown: e.shown }] : []
    })
  }

  view(worktreeId: string): EditorViewLike | undefined {
    return this.#entries.get(worktreeId)?.view
  }

  setMax(n: number): void {
    for (const evicted of this.#lru.setMax(n)) this.destroy(evicted)
  }

  #create(worktree: WorktreeRef): Entry {
    const view = this.#o.createView()
    const entry: Entry = {
      view,
      worktree,
      folderKey: normalizeFolderKey(worktree.path),
      loaded: undefined,
      shown: true,
    }
    this.#entries.set(worktree.id, entry)
    this.#o.onViewCreated(worktree.id, view)
    this.#o.nativeViews.attach(viewId(worktree.id), view as unknown as WebContentsView, { panelTabId: FILES_TAB_ID })
    for (const e of this.#entries.values()) if (e !== entry) e.shown = false
    return entry
  }

  #load(e: Entry): void {
    const url = this.#o.url(e.worktree.path)
    if (!url || e.loaded === url) return
    e.loaded = url
    e.view.webContents
      .loadURL(url)
      .catch((error: unknown) => this.#o.log?.(`editor view load failed: ${String(error)}`))
  }
}
