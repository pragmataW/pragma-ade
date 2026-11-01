/** Serializes async work per key (FIFO); different keys run in parallel; a rejection never blocks the queue. */
export class KeyedMutex {
  readonly #tails = new Map<string, Promise<unknown>>()

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve()
    const result = previous.then(fn, fn)
    const tail = result.catch(() => undefined)
    this.#tails.set(key, tail)
    void tail.then(() => {
      if (this.#tails.get(key) === tail) this.#tails.delete(key)
    })
    return result
  }
}
