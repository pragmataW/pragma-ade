import { ProjectsRendererServiceToken, type Worktree } from '@pragma/module-projects/contract'
import { useMemo, useSyncExternalStore } from 'react'
import { boardCtx } from './runtime'

/** Every known worktree by id (01's renderer service is the external store). */
export function useWorktrees(): Map<string, Worktree> {
  const projects = boardCtx().services.get(ProjectsRendererServiceToken)
  const snapshot = useSyncExternalStore(projects.subscribe, projects.getSnapshot)
  return useMemo(() => new Map(snapshot.worktrees.map((w) => [w.id, w])), [snapshot])
}
