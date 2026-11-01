import type { ReactNode } from 'react'

/** ui-notes section label: 11px, 600, uppercase, 0.06em tracking. */
export function SectionLabel({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mb-2 font-semibold text-[11px] text-[var(--mu)] uppercase tracking-[0.06em]">
      {children}
    </h2>
  )
}
