import { Button } from '@pragma/ui/components/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@pragma/ui/components/dropdown-menu'
import { Icon } from '@pragma/ui/components/icon'
import type { ReactNode } from 'react'
import { GHOST_VARIANT, ICON_PX, ICONS } from '../../constants'

/** The `…` menu of a sidebar row; visible on row hover (`group`) or while open. */
export function RowMenu({ label, testId, children }: { label: string; testId: string; children: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={GHOST_VARIANT}
          size="icon-xs"
          data-testid={testId}
          aria-label={label}
          title={label}
          className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <Icon name={ICONS.menu} size={ICON_PX.row} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}
