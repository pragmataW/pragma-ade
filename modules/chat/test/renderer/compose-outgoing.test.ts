import { describe, expect, it } from 'vitest'
import type { ComposerEntry } from '../../src/contract'
import { appendDraft, composeOutgoing } from '../../src/renderer/lib/compose-outgoing'

const chip = (text: string): ComposerEntry => ({ kind: 'chip', id: text, text, labels: [`${text}.ts:1`] })

describe('composeOutgoing', () => {
  it.each([
    [[], 'hi', 'hi'],
    [[chip('A')], '', 'A'],
    [[chip('A'), chip('B')], ' note ', 'A\n\nB\n\nnote'],
  ])('(%j, %j) → %j', (chips, typed, out) => expect(composeOutgoing(chips, typed)).toBe(out))

  it.each([
    ['', 'x', 'x'],
    ['draft', 'x', 'draft\n\nx'],
  ])('appendDraft(%j, %j) → %j', (draft, add, out) => expect(appendDraft(draft, add)).toBe(out))
})
