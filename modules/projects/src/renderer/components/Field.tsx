import { Label } from '@pragma/ui/components/label'
import type { ReactNode } from 'react'

/** A labelled form row (label above the control, optional hint below). */
export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-[12px]">
        {label}
      </Label>
      {children}
      {hint && <p className="text-[11px] text-mu">{hint}</p>}
    </div>
  )
}
