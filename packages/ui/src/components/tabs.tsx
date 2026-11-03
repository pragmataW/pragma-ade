import type { ComponentProps } from 'react'
import { cn } from '../lib/utils'
import { TabsList as VendorTabsList } from '../vendor/tabs'
import { TabIndicator } from './tab-indicator'

export { Tabs, TabsContent, TabsTrigger, tabsListVariants } from '../vendor/tabs'

const LINE = 'line'

/**
 * The `line` variant's selected underline slides between triggers (`TabIndicator`) instead of each trigger drawing
 * its own; vertical lists keep the vendor's per-trigger line.
 */
export function TabsList({ className, children, ...props }: ComponentProps<typeof VendorTabsList>) {
  const line = props.variant === LINE
  return (
    <VendorTabsList
      className={cn(
        line && 'relative group-data-[orientation=horizontal]/tabs:[&>[data-slot=tabs-trigger]]:after:hidden',
        className,
      )}
      {...props}
    >
      {children}
      {line && <TabIndicator className="group-data-[orientation=vertical]/tabs:hidden" />}
    </VendorTabsList>
  )
}
