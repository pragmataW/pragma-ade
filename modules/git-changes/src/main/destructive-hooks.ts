import { type Disposable, type Logger, toDisposable } from '@pragma/sdk'
import type { BeforeDestructive, DestructiveSnapshot, GitScmHooks } from '../contract'

/** The `GitScmHooksToken` service: handlers run before every destructive operation (local history snapshots here). */
export class DestructiveHooks implements GitScmHooks {
  readonly #handlers = new Set<BeforeDestructive>()
  readonly #log: Pick<Logger, 'warn'>

  constructor(log: Pick<Logger, 'warn'>) {
    this.#log = log
  }

  onBeforeDestructive(handler: BeforeDestructive): Disposable {
    this.#handlers.add(handler)
    return toDisposable(() => this.#handlers.delete(handler))
  }

  /** Awaits every handler in registration order; a failing one is logged and the operation goes on. */
  async run(snapshot: DestructiveSnapshot): Promise<void> {
    for (const handler of [...this.#handlers]) {
      try {
        await handler(snapshot)
      } catch (error) {
        this.#log.warn('git-changes: beforeDestructive handler failed', error)
      }
    }
  }
}
