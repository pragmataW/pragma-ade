import { cva } from 'class-variance-authority'
import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { Button as VendorButton } from '../vendor/button'

export { buttonVariants } from '../vendor/button'

/** Density-aware heights (ui-notes: controls 24–30px compact, icon buttons 26–28px). */
const densitySize = cva('', {
  variants: {
    size: {
      default: 'h-[var(--control-h)] px-3',
      xs: 'h-6',
      sm: 'h-[calc(var(--control-h)-4px)]',
      lg: 'h-[calc(var(--control-h)+4px)]',
      icon: 'size-[var(--icon-btn)]',
      'icon-xs': 'size-6',
      'icon-sm': 'size-[calc(var(--icon-btn)-4px)]',
      'icon-lg': 'size-[calc(var(--icon-btn)+4px)]',
    },
  },
  defaultVariants: { size: 'default' },
})

export type ButtonProps = ComponentProps<typeof VendorButton>

export function Button({ className, size, ...props }: ButtonProps) {
  return <VendorButton size={size} className={cn(densitySize({ size }), className)} {...props} />
}
