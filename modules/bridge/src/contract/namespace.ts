import type { z } from '@pragma/sdk'
import type { BridgeRequestContext } from './server'

export interface BridgeRequestDef<I extends z.ZodTypeAny = z.ZodTypeAny, O extends z.ZodTypeAny = z.ZodTypeAny> {
  input: I
  output: O
}

export interface BridgeNamespaceDef<
  R extends Record<string, BridgeRequestDef> = Record<string, BridgeRequestDef>,
  E extends Record<string, z.ZodTypeAny> = Record<string, z.ZodTypeAny>,
> {
  readonly name: string
  readonly requests: R
  readonly events: E
}

/** A namespace's request and event schemas; it lives in the namespace owner's contract (§4.8). */
export function defineBridgeNamespace<
  const R extends Record<string, BridgeRequestDef>,
  const E extends Record<string, z.ZodTypeAny>,
>(def: { name: string; requests: R; events: E }): BridgeNamespaceDef<R, E> {
  return def
}

/** One typed handler per request of the namespace. */
export type BridgeHandlers<D extends BridgeNamespaceDef> = {
  [K in keyof D['requests']]: (
    payload: z.infer<D['requests'][K]['input']>,
    ctx: BridgeRequestContext,
  ) => z.infer<D['requests'][K]['output']> | Promise<z.infer<D['requests'][K]['output']>>
}

export type RawBridgeHandler = (payload: unknown, ctx: BridgeRequestContext) => unknown | Promise<unknown>

export type BridgeEventPayload<D extends BridgeNamespaceDef, K extends keyof D['events']> = z.infer<D['events'][K]>
