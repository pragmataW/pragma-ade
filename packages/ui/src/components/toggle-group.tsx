import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { ToggleGroupItem as VendorToggleGroupItem } from '../vendor/toggle-group'

export { ToggleGroup } from '../vendor/toggle-group'

/** Segmented control item at the density's control height. */
export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof VendorToggleGroupItem>) {
  return <VendorToggleGroupItem className={cn('h-[var(--control-h)]', className)} {...props} />
}
