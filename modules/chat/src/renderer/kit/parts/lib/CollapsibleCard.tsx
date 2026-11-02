import { cn } from '@pragma/ui'
import { ChevronRight } from '@pragma/ui/icons'
import { type ReactNode, useState } from 'react'
import { BUTTON_TYPE, ICON_PX, ICON_STROKE } from '../../../../constants'

/** A bordered card (radius 8) whose header toggles the body. */
export function CollapsibleCard({
  header,
  children,
  defaultOpen = false,
  testId,
  toggleTestId,
  className,
  attrs,
}: {
  header: ReactNode
  children?: ReactNode
  defaultOpen?: boolean
  testId?: string
  toggleTestId?: string
  className?: string
  attrs?: Record<string, string>
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      data-testid={testId}
      data-open={open}
      className={cn('rounded-lg border border-bd bg-el', className)}
      {...attrs}
    >
      <button
        type={BUTTON_TYPE}
        aria-expanded={open}
        data-testid={toggleTestId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full min-w-0 items-center gap-2 px-2.5 text-left text-[12.5px] hover:bg-hv"
      >
        <ChevronRight
          size={ICON_PX}
          strokeWidth={ICON_STROKE}
          className={cn('shrink-0 text-mu transition-transform', open && 'rotate-90')}
        />
        {header}
      </button>
      {open && children ? <div className="border-t border-bd px-2.5 py-2">{children}</div> : null}
    </div>
  )
}
