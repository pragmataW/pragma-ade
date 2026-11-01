import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { useSyncExternalStore } from 'react'
import { useStore } from 'zustand'
import { getRuntime } from './runtime'
import type { AgentsState } from './store'

const projects = () => getRuntime().ctx.services.get(ProjectsRendererServiceToken)

/** The active worktree id from 01's renderer service (re-renders on change). */
export function useActiveWorktreeId(): string | null {
  return useSyncExternalStore(
    (cb) => projects().subscribe(cb),
    () => projects().getActiveWorktree()?.id ?? null,
  )
}

/** A selector over the agents store. */
export const useAgents = <T>(selector: (s: AgentsState) => T): T => useStore(getRuntime().store, selector)
