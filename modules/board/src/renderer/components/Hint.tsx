import type { ReactNode } from 'react'

/** A hover hint around a control; it shows even while the control is disabled (that takes no pointer events). */
export function Hint({ text, children }: { text: string | undefined; children: ReactNode }) {
  return (
    <span title={text} className="inline-flex">
      {children}
    </span>
  )
}
