/** A pure most-recently-used list with a size cap; `touch` and `setMax` return the evicted keys. */
export class Lru<K> {
  #max: number
  #keys: K[] = []

  constructor(max: number) {
    this.#max = Math.max(1, max)
  }

  touch(k: K): K[] {
    this.#keys = [k, ...this.#keys.filter((x) => x !== k)]
    return this.#trim()
  }

  delete(k: K): void {
    this.#keys = this.#keys.filter((x) => x !== k)
  }

  setMax(n: number): K[] {
    this.#max = Math.max(1, n)
    return this.#trim()
  }

  /** MRU first. */
  keys(): K[] {
    return [...this.#keys]
  }

  has(k: K): boolean {
    return this.#keys.includes(k)
  }

  #trim(): K[] {
    return this.#keys.length > this.#max ? this.#keys.splice(this.#max) : []
  }
}
