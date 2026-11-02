// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { findInDiff, wrapIndex } from '../src/renderer/diff/find'

/** Two code lines split into syntax tokens, plus a gutter that must never match. */
function diff(...lines: string[][]): HTMLElement {
  const root = document.createElement('div')
  root.innerHTML = `<div data-gutter><span data-line-number-content>needle 1</span></div><div data-content>${lines
    .map((tokens, i) => `<div data-line="${i + 1}">${tokens.map((t) => `<span>${t}</span>`).join('')}</div>`)
    .join('')}</div>`
  return root
}

describe('findInDiff', () => {
  it('finds every occurrence case-insensitively, across token boundaries, never in the gutter', () => {
    const root = diff(['const ', 'Needle', ' = nee', 'dle'], ['no match here'], ['NEEDLE'])
    const found = findInDiff(root, 'needle').map((r) => r.toString())
    expect(found).toEqual(['Needle', 'needle', 'NEEDLE'])
  })

  it('treats the query literally (regex characters included)', () => {
    expect(findInDiff(diff(['a.b(c) axb']), 'a.b(').map((r) => r.toString())).toEqual(['a.b('])
  })

  it('keeps offsets right after İ (lowercasing it would add a unit and shift every match)', () => {
    expect(findInDiff(diff(['İİİstanbul ılık ', 'kalem']), 'kalem').map((r) => r.toString())).toEqual(['kalem'])
  })

  it('Turkish letters match in either case; i, İ, ı and I count as one letter', () => {
    const root = diff(['İSTANBUL istanbul Istanbul ıstanbul'], ['ÇİÇEK çiçek'], ['Ğ ğ Ş ş Ö ö Ü ü'])
    expect(findInDiff(root, 'istanbul').map((r) => r.toString())).toEqual([
      'İSTANBUL',
      'istanbul',
      'Istanbul',
      'ıstanbul',
    ])
    expect(findInDiff(root, 'Çiçek').map((r) => r.toString())).toEqual(['ÇİÇEK', 'çiçek'])
    for (const [upper, lower] of [
      ['Ğ', 'ğ'],
      ['Ş', 'ş'],
      ['Ö', 'ö'],
      ['Ü', 'ü'],
    ] as const)
      expect(findInDiff(root, lower).map((r) => r.toString())).toEqual([upper, lower])
  })

  it('finds composed and decomposed ç alike', () => {
    const decomposed = 'c\u0327ic\u0327ek'
    const root = diff([`${decomposed} çiçek`])
    expect(findInDiff(root, 'çiçek').map((r) => r.toString())).toEqual([decomposed, 'çiçek'])
  })

  it('an empty query finds nothing', () => {
    expect(findInDiff(diff(['anything']), '')).toEqual([])
  })
})

it.each([
  [0, 1, 3, 1],
  [2, 1, 3, 0],
  [0, -1, 3, 2],
  [0, 1, 0, 0],
])('wrapIndex(%i, %i, %i) = %i', (index, step, count, expected) => {
  expect(wrapIndex(index, step, count)).toBe(expected)
})
