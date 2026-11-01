import type { DeliverFn } from '../contract'

export class DuplicateDeliveryTargetError extends Error {}

/** Delivery targets by session `mode` (05 registers `terminal`, 11c `chat`); never by provider. */
export class DeliveryRegistry {
  readonly #targets = new Map<string, DeliverFn>()

  register(mode: string, fn: DeliverFn): () => void {
    if (this.#targets.has(mode)) throw new DuplicateDeliveryTargetError(`comments: delivery target "${mode}" exists`)
    this.#targets.set(mode, fn)
    return () => {
      if (this.#targets.get(mode) === fn) this.#targets.delete(mode)
    }
  }

  get(mode: string): DeliverFn | undefined {
    return this.#targets.get(mode)
  }
}
