import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { Input as VendorInput } from '../vendor/input'

export function Input({ className, ...props }: ComponentProps<typeof VendorInput>) {
  return <VendorInput className={cn('h-[var(--control-h)]', className)} {...props} />
}
