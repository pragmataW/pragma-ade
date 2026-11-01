type Timer = ReturnType<typeof setTimeout>

export type Debounced<A extends unknown[]> = ((...a: A) => void) & { cancel(): void; flush(): void }
export type Throttled<A extends unknown[]> = ((...a: A) => void) & { cancel(): void }

/** Runs `fn` on the trailing edge only, with the last arguments. */
export function debounce<A extends unknown[]>(fn: (...a: A) => void, ms: number): Debounced<A> {
  let timer: Timer | undefined
  let pending: A | undefined
  const run = (): void => {
    timer = undefined
    const args = pending
    pending = undefined
    if (args) fn(...args)
  }
  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  const debounced = (...a: A): void => {
    pending = a
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(run, ms)
  }
  const flush = (): void => {
    if (timer === undefined) return
    clearTimeout(timer)
    run()
  }
  return Object.assign(debounced, { cancel, flush })
}

/** Runs `fn` on the leading edge, then once on the trailing edge with the last arguments. */
export function throttle<A extends unknown[]>(fn: (...a: A) => void, ms: number): Throttled<A> {
  let timer: Timer | undefined
  let pending: A | undefined
  const endWindow = (): void => {
    timer = undefined
    if (!pending) return
    const args = pending
    pending = undefined
    fn(...args)
    timer = setTimeout(endWindow, ms)
  }
  const throttled = (...a: A): void => {
    if (timer !== undefined) {
      pending = a
      return
    }
    fn(...a)
    timer = setTimeout(endWindow, ms)
  }
  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    pending = undefined
  }
  return Object.assign(throttled, { cancel })
}
