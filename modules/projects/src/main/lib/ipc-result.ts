import { type Disposable, err, type IpcContract, ok, type Result } from '@pragma/sdk'
import type { MainIpcApi } from '@pragma/sdk/main'
import { type ProjectsErrorDto, toErrorDto } from '../../contract'

/** The single place that turns a mutation handler into `Result<O, ProjectsErrorDto>` (expected errors as values). */
export function handleResult<I, O>(
  ipc: MainIpcApi,
  contract: IpcContract<I, Result<O, ProjectsErrorDto>>,
  fn: (input: I) => O | Promise<O>,
): Disposable {
  return ipc.handle(contract, async (input) => {
    try {
      return ok(await fn(input))
    } catch (e) {
      return err(toErrorDto(e))
    }
  })
}
