import { cn } from '@pragma/ui'
import type { ReactNode } from 'react'

/** Mono 12px pre-formatted text, scrolling inside `maxHeight`. */
export function MonoPre({
  children,
  maxHeight,
  className,
}: {
  children: ReactNode
  maxHeight?: number
  className?: string
}) {
  return (
    <pre
      style={maxHeight ? { maxHeight } : undefined}
      className={cn('overflow-auto whitespace-pre-wrap break-words font-mono text-[12px] leading-5 text-tx', className)}
    >
      {children}
    </pre>
  )
}
