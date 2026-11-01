import { type Disposable, toDisposable } from '../../common/disposable'
import type { EventDef } from '../../common/events'
import type { Logger } from '../../common/logger'

export interface EventBus {
  emit<P>(def: EventDef<P>, payload: P): void
  on<P>(def: EventDef<P>, cb: (payload: P) => void): Disposable
}

/** Main-process event bus; a throwing listener is logged and does not affect the others. */
export function createEventBus(log: Logger): EventBus {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  return {
    emit(def, payload) {
      for (const cb of [...(listeners.get(def.name) ?? [])]) {
        try {
          cb(payload)
        } catch (error) {
          log.error(`listener of ${def.name} threw`, error)
        }
      }
    },
    on(def, cb) {
      const set = listeners.get(def.name) ?? new Set()
      listeners.set(def.name, set)
      const fn = cb as (payload: unknown) => void
      set.add(fn)
      return toDisposable(() => set.delete(fn))
    },
  }
}
