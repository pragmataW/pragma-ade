import { type ComponentType, createContext, useContext } from 'react'
import { useStore } from 'zustand'
import type { ProjectsIpc, ProjectsState, ProjectsStore } from '../store'
import type { UiState, UiStore } from '../ui-store'

/** Everything the projects components share; provided around every registered component. */
export interface ProjectsRuntime {
  store: ProjectsStore
  ui: UiStore
  ipc: ProjectsIpc
}

export class MissingProjectsRuntimeError extends Error {}

const RuntimeContext = createContext<ProjectsRuntime | null>(null)

export function useRuntime(): ProjectsRuntime {
  const runtime = useContext(RuntimeContext)
  if (!runtime) throw new MissingProjectsRuntimeError('projects component rendered outside its runtime')
  return runtime
}

export const useProjects = <T,>(selector: (s: ProjectsState) => T): T => useStore(useRuntime().store, selector)
export const useUi = <T,>(selector: (s: UiState) => T): T => useStore(useRuntime().ui, selector)

/** Wraps a component registered with the shell so it can read the projects runtime. */
export function withRuntime<P extends object>(runtime: ProjectsRuntime, Component: ComponentType<P>): ComponentType<P> {
  function WithProjectsRuntime(props: P) {
    return (
      <RuntimeContext.Provider value={runtime}>
        <Component {...props} />
      </RuntimeContext.Provider>
    )
  }
  return WithProjectsRuntime
}
