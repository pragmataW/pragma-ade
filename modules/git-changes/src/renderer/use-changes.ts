import { type LatestAsync, useLatestAsync } from '@pragma/sdk/renderer'
import { useEffect } from 'react'
import {
  type ChangedFile,
  type ChangeList,
  type ChangeMode,
  changesChangedEvent,
  type FileDiffContents,
  fileContentsIpc,
  listChangesIpc,
} from '../contract'
import { getRendererCtx } from './lib/sdk'
import { entryKey } from './tree/build-tree'

export interface Loaded<T> {
  /** The value for the current key only (never a previous worktree's or file's). */
  data: T | undefined
  error: unknown
  loading: boolean
  reload(): void
}

/**
 * `useLatestAsync` (latest wins) over a string key; results are tagged with their key so a slow answer for an old
 * key is never shown, and the data stays in place while the same key reloads.
 */
export function useKeyedLatest<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const r: LatestAsync<{ key: string; value: T } | null> = useLatestAsync(
    async () => (key === null ? null : { key, value: await load() }),
    [key],
  )
  const current = r.data && r.data.key === key ? r.data.value : undefined
  return { data: current, error: r.error, loading: r.loading, reload: r.reload }
}

/** Calls `reload` whenever main reports changes for `worktreeId`. */
export function useReloadOnChanges(worktreeId: string | null, reload: () => void): void {
  useEffect(() => {
    if (worktreeId === null) return
    const sub = getRendererCtx().ipc.subscribe(changesChangedEvent, (p) => {
      if (p.worktreeId === worktreeId) reload()
    })
    return () => sub.dispose()
  }, [worktreeId, reload])
}

export function useChangeList(worktreeId: string | null, mode: ChangeMode): Loaded<ChangeList> {
  const key = worktreeId === null ? null : `${worktreeId}:${mode}`
  const loaded = useKeyedLatest(key, () =>
    getRendererCtx().ipc.invoke(listChangesIpc, { worktreeId: worktreeId as string, mode }),
  )
  useReloadOnChanges(worktreeId, loaded.reload)
  return loaded
}

export function useFileContents(
  worktreeId: string | null,
  mode: ChangeMode,
  file: ChangedFile | null,
): Loaded<FileDiffContents> {
  const key = worktreeId === null || file === null ? null : `${worktreeId}:${mode}:${entryKey(file)}:${file.status}`
  const loaded = useKeyedLatest(key, () => {
    const { path, oldPath, status, staged } = file as ChangedFile
    return getRendererCtx().ipc.invoke(fileContentsIpc, {
      worktreeId: worktreeId as string,
      mode,
      path,
      status,
      ...(oldPath ? { oldPath } : {}),
      ...(staged ? { staged } : {}),
    })
  })
  useReloadOnChanges(worktreeId, loaded.reload)
  return loaded
}
