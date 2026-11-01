import { debounce } from '@pragma/sdk'
import { useLatestAsync } from '@pragma/sdk/renderer'
import { useEffect, useMemo, useState } from 'react'
import { PATH_SUGGEST_DEBOUNCE_MS } from '../../constants'
import { projectsIpc } from '../../contract'
import { useRuntime } from './runtime'
import { runAction } from './use-projects-action'

/** Keeps `setPath` on the suggested location for `branch` (debounced) until the user edits the path. */
export function useSuggestedPath(projectId: string, branch: string, userEdited: boolean, setPath: (p: string) => void) {
  const { ipc } = useRuntime()
  const [settled, setSettled] = useState(branch)
  const settle = useMemo(() => debounce(setSettled, PATH_SUGGEST_DEBOUNCE_MS), [])
  useEffect(() => settle(branch), [settle, branch])
  useEffect(() => settle.cancel, [settle])
  // Nothing to suggest for an empty branch: the server picks the location while the field stays empty.
  const wanted = !userEdited && settled !== ''
  const suggested = useLatestAsync(
    async () => (wanted ? runAction(ipc, projectsIpc.suggestWorktreePath, { projectId, branch: settled }) : null),
    [ipc, projectId, settled, wanted],
  )
  const path = suggested.data?.ok ? suggested.data.value.path : null
  useEffect(() => {
    if (wanted && path !== null) setPath(path)
  }, [path, wanted, setPath])
}
