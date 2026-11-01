import { useT } from '@pragma/sdk/renderer'
import { useCallback } from 'react'
import { agentsErrorKey } from '../../contract'

/** `AgentsError` (also after IPC) → translated text; other errors → their message. */
export function useAgentsErrorText(): (err: unknown) => string {
  const t = useT()
  return useCallback(
    (err: unknown) => {
      const parsed = agentsErrorKey(err)
      if (parsed) return t(parsed.key, parsed.params)
      return err instanceof Error ? err.message : String(err)
    },
    [t],
  )
}
