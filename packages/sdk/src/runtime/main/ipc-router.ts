import { type Disposable, toDisposable } from '../../common/disposable'
import {
  IPC_ERROR,
  IpcChannelError,
  type IpcContract,
  type IpcErrorCode,
  type IpcEventContract,
  type IpcResponse,
} from '../../common/ipc'
import type { Logger } from '../../common/logger'
import type { IpcMeta, IpcRequest, IpcTransport } from '../shared/memory-transport'

export class DuplicateHandlerError extends Error {}

export type IpcHandler<I, O> = (input: I, meta: IpcMeta) => O | Promise<O>

type AnyHandler = { contract: IpcContract<unknown, unknown>; run: IpcHandler<unknown, unknown> }

const failure = (code: IpcErrorCode, message: string): IpcResponse => ({ ok: false, error: { code, message } })
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** Main-side typed IPC: validates input and output of every handler (§4.3). */
export class IpcRouter {
  readonly #handlers = new Map<string, AnyHandler>()
  readonly #transport: IpcTransport
  readonly #log: Logger

  constructor(transport: IpcTransport, log: Logger) {
    this.#transport = transport
    this.#log = log
    transport.onInvoke((req, meta) => this.dispatch(req, meta))
  }

  handle<I, O>(c: IpcContract<I, O>, h: IpcHandler<I, O>, owner?: string): Disposable {
    if (owner !== undefined && !c.channel.startsWith(`${owner}.`))
      throw new IpcChannelError(`module "${owner}" cannot handle foreign channel ${c.channel}`)
    if (this.#handlers.has(c.channel)) throw new DuplicateHandlerError(`IPC channel ${c.channel} already has a handler`)
    this.#handlers.set(c.channel, {
      contract: c as IpcContract<unknown, unknown>,
      run: h as IpcHandler<unknown, unknown>,
    })
    return toDisposable(() => this.#handlers.delete(c.channel))
  }

  has(channel: string): boolean {
    return this.#handlers.has(channel)
  }

  async dispatch(req: IpcRequest, meta: IpcMeta): Promise<IpcResponse> {
    const entry = this.#handlers.get(req.channel)
    if (!entry) return failure(IPC_ERROR.noHandler, `no handler for ${req.channel}`)
    const input = entry.contract.input.safeParse(req.input)
    if (!input.success) return failure(IPC_ERROR.invalidInput, input.error.message)
    let value: unknown
    try {
      value = await entry.run(input.data, meta)
    } catch (error) {
      this.#log.error(`IPC handler ${req.channel} failed`, error)
      return failure(IPC_ERROR.handlerError, messageOf(error))
    }
    const output = entry.contract.output.safeParse(value)
    if (!output.success) return failure(IPC_ERROR.invalidOutput, output.error.message)
    return { ok: true, value: output.data }
  }

  /** Main → renderer event (`ctx.ipc.publish`, §10.2). */
  publish<P>(c: IpcEventContract<P>, payload: P): void {
    this.#transport.broadcast(c.channel, c.payload.parse(payload))
  }
}
