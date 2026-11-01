export interface EventDef<P> {
  readonly name: string
  /** Phantom field carrying the payload type. */
  readonly __payload?: P
}

export const defineEvent = <P>(name: string): EventDef<P> => ({ name })
