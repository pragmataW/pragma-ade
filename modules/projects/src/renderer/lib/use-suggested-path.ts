import { useEffect } from 'react'
import { PATH_SUGGEST_DEBOUNCE_MS } from '../../constants'
import { projectsIpc } from '../../contract'
import { useRuntime } from './runtime'
import { runAction } from './use-projects-action'

/** Keeps `setPath` on the suggested location for `branch` (debounced) until the user edits the path. */
export function useSuggestedPath(projectId: string, branch: string, userEdited: boolean, setPath: (p: string) => void) {
  const { ipc } = useRuntime()
  useEffect(() => {
    if (userEdited) return
    let current = true
    const timer = setTimeout(() => {
      void runAction(ipc, projectsIpc.suggestWorktreePath, { projectId, branch }).then((r) => {
        if (current && r.ok) setPath(r.value.path)
      })
    }, PATH_SUGGEST_DEBOUNCE_MS)
    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [ipc, projectId, branch, userEdited, setPath])
}
