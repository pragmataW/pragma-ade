/**
 * Runs one task at a time; while one runs, newer values replace the waiting one (last write wins). Theme events
 * arrive faster than VS Code writes settings, and two overlapping read-modify-write applies mix two themes.
 */
export class LatestQueue<T> {
  readonly #run: (value: T) => Promise<void>
  readonly #onError: (error: unknown) => void
  #waiting: { value: T } | undefined
  #draining: Promise<void> | undefined

  constructor(run: (value: T) => Promise<void>, onError: (error: unknown) => void) {
    this.#run = run
    this.#onError = onError
  }

  /** Resolves once the queue is idle again (never rejects; failures go to `onError`). */
  push(value: T): Promise<void> {
    this.#waiting = { value }
    this.#draining ??= this.#drain()
    return this.#draining
  }

  async #drain(): Promise<void> {
    try {
      for (let next = this.#take(); next; next = this.#take()) {
        try {
          await this.#run(next.value)
        } catch (error) {
          this.#onError(error)
        }
      }
    } finally {
      this.#draining = undefined
    }
  }

  #take(): { value: T } | undefined {
    const next = this.#waiting
    this.#waiting = undefined
    return next
  }
}
