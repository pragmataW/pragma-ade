import { useState } from 'react'

/**
 * A form value that follows `derived` (e.g. the branch suggested from the task title) until the user edits it;
 * after an edit the user's value wins.
 */
export function useDerivedDraft<V>(derived: V): [V, (value: V) => void] {
  const [edited, setEdited] = useState<{ value: V } | null>(null)
  return [edited ? edited.value : derived, (value) => setEdited({ value })]
}
