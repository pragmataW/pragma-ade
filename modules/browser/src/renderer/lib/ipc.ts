import type { IpcContract } from '@pragma/sdk'
import { runtime } from '../runtime'

/** Fire-and-forget IPC from UI handlers; failures are logged, the next snapshot shows the real state. */
export function send<I, O>(contract: IpcContract<I, O>, input: I): Promise<O | undefined> {
  return runtime()
    .ctx.ipc.invoke(contract, input)
    .catch((error: unknown) => {
      console.warn(`browser: ${contract.channel} failed`, error)
      return undefined
    })
}
