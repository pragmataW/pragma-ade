import type { Comment } from '@pragma/module-comments/contract'
import { describe, expect, it } from 'vitest'
import { toAnnotations } from '../src/renderer/diff/annotations'
import { draftCounts, toAnnotationSide, toDiffSide } from '../src/renderer/lib/comments'

const comment = (id: string, over: Partial<Comment>): Comment => ({
  id,
  worktreeId: 'w',
  source: 'diff',
  filePath: 'a.ts',
  lineStart: 1,
  lineEnd: 2,
  diffSide: 'new',
  body: 'b',
  createdAt: 0,
  updatedAt: 0,
  ...over,
})

describe('diff annotations', () => {
  it('comments of this file on both sides, then the composer last', () => {
    const list = [
      comment('old', { diffSide: 'old', lineStart: 4, lineEnd: 6 }),
      comment('new', { diffSide: 'new', lineStart: 2, lineEnd: 2 }),
      comment('other', { filePath: 'b.ts' }),
    ]
    const composer = { source: 'diff' as const, filePath: 'a.ts', lineStart: 7, lineEnd: 9, diffSide: 'new' as const }
    const out = toAnnotations(list, composer, { path: 'a.ts' })
    expect(out.map((a) => [a.side, a.lineNumber, a.metadata.kind])).toEqual([
      ['deletions', 6, 'comment'],
      ['additions', 2, 'comment'],
      ['additions', 9, 'composer'],
    ])
  })

  it('old-side comments of a renamed file match its old path', () => {
    const out = toAnnotations([comment('o', { diffSide: 'old', filePath: 'old.ts' })], null, {
      path: 'new.ts',
      oldPath: 'old.ts',
    })
    expect(out).toHaveLength(1)
  })

  it.each([
    ['additions', 'new'],
    ['deletions', 'old'],
  ] as const)('side %s ↔ %s', (side, diffSide) => {
    expect(toDiffSide(side)).toBe(diffSide)
    expect(toAnnotationSide(diffSide)).toBe(side)
  })

  it('an unknown side reads as additions; draft counts per file', () => {
    expect(toAnnotationSide(undefined)).toBe('additions')
    const list = [comment('1', {}), comment('2', {}), comment('4', { filePath: 'b.ts' })]
    expect(draftCounts(list)).toEqual({ 'a.ts': 2, 'b.ts': 1 })
  })
})
