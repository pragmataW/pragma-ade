import type { ReactNode } from 'react'

/** A label/value row of the drawer grid. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <span className="pt-1.5 text-[11px] text-[var(--mu)] uppercase tracking-[0.06em]">{label}</span>
      <div className="min-w-0">{children}</div>
    </>
  )
}
