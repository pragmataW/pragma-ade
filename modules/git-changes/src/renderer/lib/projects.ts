import { ProjectsRendererServiceToken, type Worktree } from '@pragma/module-projects/contract'
import { useSyncExternalStore } from 'react'
import { getRendererCtx } from './sdk'

const projects = () => getRendererCtx().services.get(ProjectsRendererServiceToken)

/** The worktree selected in the sidebar (01), re-rendering on change. */
export function useActiveWorktree(): Worktree | null {
  const service = projects()
  return useSyncExternalStore(service.subscribe, service.getActiveWorktree)
}

/** 01's changed-file count of a worktree (the number the sidebar shows), or null while unknown. */
export function useChangedCount(worktreeId: string | null): number | null {
  const service = projects()
  return useSyncExternalStore(service.subscribe, () =>
    worktreeId === null ? null : (service.getSnapshot().changedFiles[worktreeId] ?? null),
  )
}
