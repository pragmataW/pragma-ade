import { useT } from '@pragma/sdk/renderer'
import { cn } from '@pragma/ui'
import { Button } from '@pragma/ui/components/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@pragma/ui/components/dropdown-menu'
import { MENU_ALIGN, SIZE, VARIANT } from '../../constants'
import { BOARD_TESTID_ATTRS as A, BOARD_TESTIDS as T } from '../../contract'

export interface FilterOption {
  value: string
  label: string
}

/** A multi-select filter chip; shows the selection count when active. */
export function FilterChip(props: {
  testId: string
  label: string
  options: FilterOption[]
  selected: string[]
  onChange(selected: string[]): void
}) {
  const t = useT()
  const { selected } = props
  const toggle = (v: string) =>
    props.onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          data-testid={props.testId}
          variant={VARIANT.outline}
          size={SIZE.sm}
          className={cn(selected.length > 0 && 'border-[var(--ac)] text-[var(--act)]')}
        >
          {selected.length > 0 ? t('board:filter.count', { label: props.label, count: selected.length }) : props.label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={MENU_ALIGN.start}>
        {props.options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            data-testid={T.filterOption}
            {...{ [A.value]: o.value }}
            checked={selected.includes(o.value)}
            onCheckedChange={() => toggle(o.value)}
          >
            {o.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
