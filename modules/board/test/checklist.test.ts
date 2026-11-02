import { describe, expect, it } from 'vitest'
import { checklistProgress } from '../src/lib/checklist'

describe('checklistProgress', () => {
  it('counts GFM task items and the checked ones', () => {
    const md = [
      'Steps',
      '',
      '- [x] login form',
      '* [ ] error text',
      '  1. [X] nested',
      '- [] not an item',
      '- plain',
    ].join('\n')
    expect(checklistProgress(md)).toEqual({ done: 2, total: 3 })
  })

  it('is empty without task items', () => {
    expect(checklistProgress('Just text\n- a bullet')).toEqual({ done: 0, total: 0 })
  })
})
