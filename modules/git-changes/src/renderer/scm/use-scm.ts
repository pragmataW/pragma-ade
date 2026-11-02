import {
  type ChangedFile,
  type HunkInfo,
  type ScmState,
  type StashEntry,
  scmHunksIpc,
  scmStashFilesIpc,
  scmStashListIpc,
  scmStateIpc,
} from '../../contract'
import { getRendererCtx } from '../lib/sdk'
import { entryKey } from '../tree/build-tree'
import { type Loaded, useKeyedLatest, useReloadOnChanges } from '../use-changes'

/** A `useKeyedLatest` that also reloads whenever main reports changes for the worktree. */
function useLive<T>(worktreeId: string, key: string | null, load: () => Promise<T>): Loaded<T> {
  const loaded = useKeyedLatest(key, load)
  useReloadOnChanges(worktreeId, loaded.reload)
  return loaded
}

export const useScmState = (worktreeId: string): ScmState | undefined =>
  useLive(worktreeId, worktreeId, () => getRendererCtx().ipc.invoke(scmStateIpc, { worktreeId })).data

export const useStashes = (worktreeId: string): StashEntry[] =>
  useLive(worktreeId, worktreeId, () => getRendererCtx().ipc.invoke(scmStashListIpc, { worktreeId })).data?.stashes ??
  []

/** The files of an expanded stash (null: collapsed, nothing loaded). */
export const useStashFiles = (worktreeId: string, sha: string | null): ChangedFile[] | undefined =>
  useLive(worktreeId, sha && `${worktreeId}:${sha}`, () =>
    getRendererCtx().ipc.invoke(scmStashFilesIpc, { worktreeId, sha: sha as string }),
  ).data?.files

/** The git hunks of an entry's staged or unstaged diff (null file: none). */
export const useHunks = (worktreeId: string, file: ChangedFile | null): HunkInfo[] =>
  useLive(worktreeId, file && `${worktreeId}:${entryKey(file)}:${file.status}`, () =>
    getRendererCtx().ipc.invoke(scmHunksIpc, {
      worktreeId,
      path: (file as ChangedFile).path,
      staged: (file as ChangedFile).staged === true,
    }),
  ).data?.hunks ?? []
