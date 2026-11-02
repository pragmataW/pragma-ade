import type { ComposerEntry } from '../../contract'

const PARAGRAPH = '\n\n'

/** The text sent for chips + typed text: chip texts first, then the typed text, separated by blank lines. */
export function composeOutgoing(chips: readonly ComposerEntry[], typed: string): string {
  if (chips.length === 0) return typed
  return [...chips.map((c) => c.text), typed.trim()].filter(Boolean).join(PARAGRAPH)
}

/** Appends `add` to an existing draft with a blank line in between. */
export const appendDraft = (draft: string, add: string): string => (draft ? `${draft}${PARAGRAPH}${add}` : add)
