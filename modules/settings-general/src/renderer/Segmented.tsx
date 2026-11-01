import { ToggleGroup, ToggleGroupItem } from '@pragma/ui/components/toggle-group'
import { OUTLINE_VARIANT, SINGLE_SELECT } from '../constants'

/** Single-choice segmented control (ui-notes: Mode Dark / Light / System, Density Compact / Comfortable). */
export function Segmented<V extends string>({
  value,
  options,
  label,
  testId,
  onChange,
}: {
  value: V
  options: readonly V[]
  label(v: V): string
  testId(v: V): string
  onChange(v: V): void
}) {
  return (
    <ToggleGroup
      type={SINGLE_SELECT}
      variant={OUTLINE_VARIANT}
      value={value}
      onValueChange={(v: string) => v && onChange(v as V)}
    >
      {options.map((o) => (
        <ToggleGroupItem key={o} value={o} data-testid={testId(o)} className="px-3">
          {label(o)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
