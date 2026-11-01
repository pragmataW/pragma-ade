import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import { useRendererHost } from './context'
import { ErrorBoundary } from './ErrorBoundary'
import type { SlotEntry } from './types'

const EMPTY: SlotEntry<never>[] = []

/** Renders every entry registered for `id` (sorted by order, each isolated); `single` keeps the first match. */
export function Slot<P extends object = Record<string, never>>({
  id,
  props,
  single,
  fallback,
}: {
  id: string
  props?: P
  single?: boolean
  fallback?: ReactNode
}) {
  const host = useRendererHost()
  const entries = useStore(host.registries.store, (s) => s.slots[id] ?? EMPTY) as SlotEntry<P>[]
  const value = (props ?? {}) as P
  const matching = entries.filter((e) => !e.match || e.match(value))
  const shown = single ? matching.slice(0, 1) : matching
  if (shown.length === 0) return <>{fallback ?? null}</>
  return (
    <>
      {shown.map((entry) => (
        <ErrorBoundary key={entry.id} name={`slot ${id}/${entry.id}`}>
          <entry.component {...value} />
        </ErrorBoundary>
      ))}
    </>
  )
}
