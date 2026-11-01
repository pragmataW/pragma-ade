import { useCallback, useEffect, useRef, useState } from 'react'

export interface LatestAsync<T> {
  data: T | undefined
  error: unknown
  loading: boolean
  reload(): void
}

/** Runs `fn` when `deps` change (or on `reload`), aborting the previous call; only the latest result is applied. */
export function useLatestAsync<T>(fn: (signal: AbortSignal) => Promise<T>, deps: readonly unknown[]): LatestAsync<T> {
  const [state, setState] = useState<{ data?: T; error?: unknown; loading: boolean }>({ loading: true })
  const [generation, setGeneration] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn
  // biome-ignore lint/correctness/useExhaustiveDependencies: the caller's deps drive re-runs (like useEffect)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setState((s) => ({ ...s, loading: true }))
    fnRef.current(controller.signal).then(
      (data) => current && setState({ data, loading: false }),
      (error: unknown) => current && setState({ error, loading: false }),
    )
    return () => {
      current = false
      controller.abort()
    }
  }, [...deps, generation])
  const reload = useCallback(() => setGeneration((g) => g + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}
