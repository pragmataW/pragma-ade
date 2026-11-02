import { CHECKLIST_ITEM_RE } from '../constants'

export interface ChecklistProgress {
  done: number
  total: number
}

/** The acceptance checklist in a Markdown description: GFM task items (`- [ ]`, `* [x]`, `1. [X]`). */
export function checklistProgress(markdown: string): ChecklistProgress {
  let done = 0
  let total = 0
  for (const m of markdown.matchAll(CHECKLIST_ITEM_RE)) {
    total++
    if (m.groups?.mark?.toLowerCase() === 'x') done++
  }
  return { done, total }
}
