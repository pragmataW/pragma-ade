import { cn } from '@pragma/ui'
import type { ReactNode } from 'react'
import { BOARD_TESTID_ATTRS as A, type LabelDto, BOARD_TESTIDS as T } from '../../contract'

/** Coloured dot + label name. */
export function LabelChip({
  label,
  className,
  children,
}: {
  label: LabelDto
  className?: string
  children?: ReactNode
}) {
  return (
    <span
      data-testid={T.cardLabel}
      {...{ [A.labelName]: label.name }}
      className={cn(
        'inline-flex items-center gap-1 rounded-[var(--radius-chip)] border border-[var(--bd)] px-1.5 text-[11px] text-[var(--mu)] leading-4',
        className,
      )}
    >
      <span className="size-1.5 rounded-full" style={{ background: `var(--board-label-${label.color})` }} />
      {label.name}
      {children}
    </span>
  )
}
