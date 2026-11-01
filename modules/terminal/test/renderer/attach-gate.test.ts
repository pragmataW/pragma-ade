import { expect, test } from 'vitest'
import { createAttachGate } from '../../src/renderer/view/attach-gate'

test('drops buffered events covered by the snapshot, keeps later ones, de-dups', () => {
  const g = createAttachGate()
  for (const seq of [4, 5, 6]) g.push({ seq, data: String(seq) })
  expect(g.isOpen).toBe(false)
  expect(g.open(5)).toEqual(['6'])
  expect(g.isOpen).toBe(true)
  expect(g.accept({ seq: 6, data: '6' })).toBeNull()
  expect(g.accept({ seq: 7, data: '7' })).toBe('7')
})

test('an empty snapshot (seq 0) keeps every buffered event', () => {
  const g = createAttachGate()
  g.push({ seq: 1, data: 'a' })
  g.push({ seq: 2, data: 'b' })
  expect(g.open(0)).toEqual(['a', 'b'])
})
