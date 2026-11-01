/** Fixed-capacity FIFO buffer; when full, `push` drops the oldest item. */
export class RingBuffer<T> {
  readonly capacity: number
  #items: T[] = []
  #head = 0

  constructor(capacity: number) {
    if (!Number.isInteger(capacity) || capacity < 1) throw new RangeError(`RingBuffer capacity must be >= 1`)
    this.capacity = capacity
  }

  get size(): number {
    return this.#items.length
  }

  push(value: T): void {
    if (this.#items.length < this.capacity) {
      this.#items.push(value)
      return
    }
    this.#items[this.#head] = value
    this.#head = (this.#head + 1) % this.capacity
  }

  toArray(): T[] {
    return [...this.#items.slice(this.#head), ...this.#items.slice(0, this.#head)]
  }

  clear(): void {
    this.#items = []
    this.#head = 0
  }
}
