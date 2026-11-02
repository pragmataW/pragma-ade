import type { IpcContract, Result } from '@pragma/sdk'
import { BoardError, type BoardErrorDto } from '../../contract'
import { boardCtx } from './runtime'

/** Invokes a board channel and unwraps its `Result` (an error value is rethrown as `BoardError`). */
export async function call<I, O>(contract: IpcContract<I, Result<O, BoardErrorDto>>, input: I): Promise<O> {
  const r = await boardCtx().ipc.invoke(contract, input)
  if (!r.ok) throw new BoardError(r.error.code, r.error.message)
  return r.value
}
