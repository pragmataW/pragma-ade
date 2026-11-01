import { type ZodType, z } from 'zod'
import { IPC_CHANNEL_PATTERN } from './patterns'

export interface IpcContract<I, O> {
  readonly channel: string
  readonly input: ZodType<I>
  readonly output: ZodType<O>
}

export interface IpcEventContract<P> {
  readonly channel: string
  readonly payload: ZodType<P>
}

export type IpcInput<C> = C extends IpcContract<infer I, unknown> ? I : never
export type IpcOutput<C> = C extends IpcContract<unknown, infer O> ? O : never

export class IpcChannelError extends Error {}

export function assertChannel(channel: string): void {
  if (!IPC_CHANNEL_PATTERN.test(channel))
    throw new IpcChannelError(`invalid IPC channel "${channel}" (expected "<module-id>.<action>")`)
}

export function defineIpc<I, O>(c: { channel: string; input: ZodType<I>; output: ZodType<O> }): IpcContract<I, O> {
  assertChannel(c.channel)
  return c
}

export function defineIpcEvent<P>(c: { channel: string; payload: ZodType<P> }): IpcEventContract<P> {
  assertChannel(c.channel)
  return c
}

export const IPC_ERROR_CODES = ['NO_HANDLER', 'INVALID_INPUT', 'INVALID_OUTPUT', 'HANDLER_ERROR'] as const
export type IpcErrorCode = (typeof IPC_ERROR_CODES)[number]
export const IPC_ERROR = {
  noHandler: 'NO_HANDLER',
  invalidInput: 'INVALID_INPUT',
  invalidOutput: 'INVALID_OUTPUT',
  handlerError: 'HANDLER_ERROR',
} as const satisfies Record<string, IpcErrorCode>

export const IpcErrorPayloadSchema = z.object({ code: z.enum(IPC_ERROR_CODES), message: z.string() })
export type IpcErrorPayload = z.infer<typeof IpcErrorPayloadSchema>

export const IpcResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), value: z.unknown() }),
  z.object({ ok: z.literal(false), error: IpcErrorPayloadSchema }),
])
export type IpcResponse = z.infer<typeof IpcResponseSchema>

export class IpcError extends Error {
  readonly code: IpcErrorCode
  constructor(code: IpcErrorCode, message: string) {
    super(message)
    this.name = 'IpcError'
    this.code = code
  }
}
