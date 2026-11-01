import { useRef } from 'react'

/** A ref that always holds the latest value (callbacks from props without re-running effects). */
export function useLatest<T>(value: T): { readonly current: T } {
  const ref = useRef(value)
  ref.current = value
  return ref
}
