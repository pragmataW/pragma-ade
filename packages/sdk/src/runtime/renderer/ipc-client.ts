import { type Disposable, toDisposable } from '../../common/disposable'
import { IPC_ERROR, type IpcContract, IpcError, type IpcEventContract } from '../../common/ipc'
import type { Logger } from '../../common/logger'
import type { PragmaBridge } from '../shared/memory-transport'

export interface IpcClient {
  invoke<I, O>(c: IpcContract<I, O>, input: I): Promise<O>
  subscribe<P>(c: IpcEventContract<P>, cb: (payload: P) => void): Disposable
}

export function createIpcClient(bridge: PragmaBridge, log?: Logger): IpcClient {
  return {
    async invoke(c, input) {
      const parsed = c.input.safeParse(input)
      if (!parsed.success) throw new IpcError(IPC_ERROR.invalidInput, parsed.error.message)
      const res = await bridge.invoke(c.channel, parsed.data)
      if (!res.ok) throw new IpcError(res.error.code, res.error.message)
      return c.output.parse(res.value)
    },
    subscribe(c, cb) {
      const off = bridge.subscribe(c.channel, (payload) => {
        const parsed = c.payload.safeParse(payload)
        if (parsed.success) cb(parsed.data)
        else log?.warn(`dropped invalid ${c.channel} payload`, parsed.error.message)
      })
      return toDisposable(off)
    },
  }
}
