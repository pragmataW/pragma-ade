import { useT } from '@pragma/sdk/renderer'
import type { ChatOptionChoice } from '../../../contract'

/** A choice's text: its literal label, else its label key, else the raw value. */
export function useChoiceLabel() {
  const t = useT()
  return (c: ChatOptionChoice | undefined): string => c?.label ?? (c?.labelKey ? t(c.labelKey) : String(c?.value ?? ''))
}

/** A choice's one-line description (literal, else key), if any. */
export function useChoiceDescription() {
  const t = useT()
  return (c: ChatOptionChoice): string | undefined =>
    c.description ?? (c.descriptionKey ? t(c.descriptionKey) : undefined)
}
