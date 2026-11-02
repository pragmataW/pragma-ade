import { type ComponentProps, createContext, type RefObject, useContext, useRef, useState } from 'react'
import { useOverlayGuard } from '../lib/overlay-guard'
import { cn } from '../lib/utils'
import {
  Select as VendorSelect,
  SelectContent as VendorSelectContent,
  SelectTrigger as VendorSelectTrigger,
} from '../vendor/select'

export {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectValue,
} from '../vendor/select'

const ContentRef = createContext<RefObject<HTMLDivElement | null> | null>(null)

/**
 * Overlay-guarded while open. The guard follows the open state, not the content: Radix keeps a closed Select's
 * content mounted (in a detached fragment, to collect its items), so a guard inside it would hide every native view
 * for as long as the Select is on screen.
 */
export function Select({ open, defaultOpen, onOpenChange, ...props }: ComponentProps<typeof VendorSelect>) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false)
  const content = useRef<HTMLDivElement>(null)
  useOverlayGuard(open ?? uncontrolledOpen, { target: content })
  return (
    <ContentRef.Provider value={content}>
      <VendorSelect
        {...props}
        open={open}
        defaultOpen={defaultOpen}
        onOpenChange={(next) => {
          setUncontrolledOpen(next)
          onOpenChange?.(next)
        }}
      />
    </ContentRef.Provider>
  )
}

/** The open listbox, measured by the guard so only native views under it are covered. */
export function SelectContent(props: ComponentProps<typeof VendorSelectContent>) {
  const ref = useContext(ContentRef)
  return <VendorSelectContent ref={ref ?? undefined} {...props} />
}

export function SelectTrigger({ className, ...props }: ComponentProps<typeof VendorSelectTrigger>) {
  return <VendorSelectTrigger className={cn('data-[size=default]:h-[var(--control-h)]', className)} {...props} />
}
