export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Polls `fn` until it returns a truthy value or the deadline passes. */
export async function waitFor<T>(fn: () => T | Promise<T>, timeoutMs = 3000, stepMs = 25): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await fn()
    if (value) return value
    if (Date.now() > deadline) throw new Error(`condition not met within ${timeoutMs}ms`)
    await sleep(stepMs)
  }
}
