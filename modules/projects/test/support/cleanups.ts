import { ProjectsError } from '../../src/contract'

/** Collects cleanups (run newest first) so suites never copy their teardown. */
export function createCleanups() {
  const list: (() => void)[] = []
  return {
    add: (fn: () => void) => void list.push(fn),
    track<T extends { cleanup(): void }>(x: T): T {
      list.push(() => x.cleanup())
      return x
    },
    run() {
      for (const fn of list.splice(0).reverse()) fn()
    },
  }
}

/** The `ProjectsError` code a promise rejects with (undefined when it resolves). */
export async function codeOf(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p
    return undefined
  } catch (e) {
    return e instanceof ProjectsError ? e.code : `non-projects: ${String(e)}`
  }
}
