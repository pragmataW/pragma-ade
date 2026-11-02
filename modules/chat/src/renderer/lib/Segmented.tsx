import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { VARIANT_OUTLINE } from '../../constants'

export interface SegmentedItem {
  value: string
  label: string
  disabled?: boolean
  /** Tooltip (also shown while disabled). */
  title?: string
  testId?: string
}

/** ui-notes segmented control (shadcn ToggleGroup, single choice). */
export function Segmented({
  value,
  items,
  onChange,
  testId,
}: {
  value: string
  items: SegmentedItem[]
  onChange(value: string): void
  testId?: string
}) {
  return (
    <ToggleGroup
      type="single"
      variant={VARIANT_OUTLINE}
      className="w-fit"
      value={value}
      data-testid={testId}
      onValueChange={(v: string) => v && onChange(v)}
    >
      {items.map((item) => (
        <span key={item.value} title={item.title} className="inline-flex">
          <ToggleGroupItem
            value={item.value}
            disabled={item.disabled}
            data-testid={item.testId}
            className="px-3 text-[12.5px]"
          >
            {item.label}
          </ToggleGroupItem>
        </span>
      ))}
    </ToggleGroup>
  )
}
