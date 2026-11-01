export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** Polls `check` every `pollMs` until it is truthy or `timeoutMs` passed; resolves to the last value. */
export async function pollUntil<T>(check: () => T | Promise<T>, timeoutMs: number, pollMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await check()
    if (value || Date.now() >= deadline) return value
    await sleep(pollMs)
  }
}
