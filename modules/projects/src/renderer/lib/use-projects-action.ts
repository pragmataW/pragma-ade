import type { IpcContract, Result } from '@pragma/sdk'
import { useCallback, useState } from 'react'
import { type ProjectsErrorDto, toErrorDto } from '../../contract'
import { useRuntime } from './runtime'

export type ActionResult<O> = { value: O } | undefined

/** Invokes `Result`-returning IPC; failures become `error` state. Resolves `undefined` on failure. */
export async function runAction<I, O>(
  ipc: ProjectsIpcLike,
  contract: IpcContract<I, Result<O, ProjectsErrorDto>>,
  input: I,
): Promise<{ ok: true; value: O } | { ok: false; error: ProjectsErrorDto }> {
  try {
    return await ipc.invoke(contract, input)
  } catch (e) {
    return { ok: false, error: toErrorDto(e) }
  }
}
type ProjectsIpcLike = ReturnType<typeof useRuntime>['ipc']

/** The only place UI callers turn a `Result` into `{ error, pending }` state. */
export function useProjectsAction<I, O>(contract: IpcContract<I, Result<O, ProjectsErrorDto>>) {
  const { ipc } = useRuntime()
  const [error, setError] = useState<ProjectsErrorDto | null>(null)
  const [pending, setPending] = useState(false)
  const run = useCallback(
    async (input: I): Promise<ActionResult<O>> => {
      setPending(true)
      setError(null)
      const result = await runAction(ipc, contract, input)
      setPending(false)
      if (result.ok) return { value: result.value }
      setError(result.error)
      return undefined
    },
    [ipc, contract],
  )
  const clear = useCallback(() => setError(null), [])
  return { run, error, pending, clear }
}
