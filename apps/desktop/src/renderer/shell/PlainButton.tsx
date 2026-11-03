import { cn } from '@pragma/ui/lib/utils'
import type { ComponentProps } from 'react'

/** A native `<button type="button">` (never submits) for shell rows and tabs; hover colours ease in (motion tokens). */
export function PlainButton({ className, ...props }: Omit<ComponentProps<'button'>, 'type'>) {
  return <button type="button" className={cn('motion-colors', className)} {...props} />
}
