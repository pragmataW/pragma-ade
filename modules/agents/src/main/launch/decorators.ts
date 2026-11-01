import type { Logger } from '@pragma/sdk'
import { type LaunchContext, type LaunchDecorator, type LaunchSpec, launchSpecSchema } from '../../contract'

export class DuplicateDecoratorError extends Error {}

/** Launch decorators of other modules (04 bridge env, 10 PATH, 11c resume), applied by `order`, then `id`. */
export class LaunchDecoratorRegistry {
  readonly #items = new Map<string, LaunchDecorator>()

  register(d: LaunchDecorator): () => void {
    if (this.#items.has(d.id)) throw new DuplicateDecoratorError(`launch decorator ${d.id} is already registered`)
    this.#items.set(d.id, d)
    return () => {
      if (this.#items.get(d.id) === d) this.#items.delete(d.id)
    }
  }

  list(): LaunchDecorator[] {
    return [...this.#items.values()].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
  }
}

/** Each result is schema-checked; a throwing or malformed decorator is logged and skipped (the last valid spec wins). */
export async function applyDecorators(
  decorators: readonly LaunchDecorator[],
  spec: LaunchSpec,
  ctx: LaunchContext,
  log: Logger,
): Promise<LaunchSpec> {
  let current = spec
  for (const d of decorators) {
    try {
      const next = launchSpecSchema.safeParse(await d.decorate(structuredClone(current), ctx))
      if (next.success) current = next.data
      else log.warn(`launch decorator ${d.id} returned an invalid spec; ignored`, next.error.message)
    } catch (error) {
      log.warn(`launch decorator ${d.id} failed; skipped`, error)
    }
  }
  return current
}
