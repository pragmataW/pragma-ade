import { ProjectsRendererServiceToken } from '@pragma/module-projects/contract'
import { useRendererContext } from '@pragma/sdk/renderer'
import { useSyncExternalStore } from 'react'

const NONE = () => () => undefined
const NULL_ID = () => null

/** The worktree selected in the sidebar (projects, optional), re-rendering on change; null without one. */
export function useActiveWorktreeId(): string | null {
  const projects = useRendererContext().services.tryGet(ProjectsRendererServiceToken)
  return useSyncExternalStore(
    projects?.subscribe ?? NONE,
    projects ? () => projects.getActiveWorktree()?.id ?? null : NULL_ID,
  )
}
