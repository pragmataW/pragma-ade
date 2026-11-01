/** Polls `fn` until it returns a truthy value (returned) or the timeout elapses (throws). */
export async function waitFor<T>(fn: () => T | Promise<T>, timeoutMs = 5000, intervalMs = 20): Promise<NonNullable<T>> {
  const deadline = Date.now() + timeoutMs
  let last: unknown
  for (;;) {
    try {
      const value = await fn()
      if (value) return value as NonNullable<T>
    } catch (error) {
      last = error
    }
    if (Date.now() > deadline)
      throw new Error(`waitFor timed out after ${timeoutMs}ms${last ? `: ${String(last)}` : ''}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/** True while a process with this pid exists (signal 0 probe). */
export function isAlive(pid: number | undefined): boolean {
  if (pid === undefined) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
