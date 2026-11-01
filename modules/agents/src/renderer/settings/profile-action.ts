import type { IpcContract } from '@pragma/sdk'
import { useCallback, useState } from 'react'
import { useAgentsErrorText } from '../lib/useAgentsErrorText'
import { getRuntime } from '../runtime'

export type RunProfileAction = <I, O>(c: IpcContract<I, O>, input: I) => Promise<boolean>

/** A Settings › Agents mutation: invoke, re-read the profiles, keep the translated error for the card. */
export function useProfileAction(): { run: RunProfileAction; error: string | null } {
  const errorText = useAgentsErrorText()
  const [error, setError] = useState<string | null>(null)
  const run = useCallback<RunProfileAction>(
    async (c, input) => {
      const { ctx, store } = getRuntime()
      setError(null)
      try {
        await ctx.ipc.invoke(c, input)
        await store.getState().reloadProfiles()
        return true
      } catch (e) {
        setError(errorText(e))
        return false
      }
    },
    [errorText],
  )
  return { run, error }
}
