import type { ComponentProps } from 'react'
import { withOverlayGuard } from '../lib/overlay-guard'
import { cn } from '../lib/utils'
import { SelectContent as VendorSelectContent, SelectTrigger as VendorSelectTrigger } from '../vendor/select'

export {
  Select,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectValue,
} from '../vendor/select'

export const SelectContent = withOverlayGuard(VendorSelectContent)

export function SelectTrigger({ className, ...props }: ComponentProps<typeof VendorSelectTrigger>) {
  return <VendorSelectTrigger className={cn('data-[size=default]:h-[var(--control-h)]', className)} {...props} />
}
