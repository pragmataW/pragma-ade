import type { Comment } from '@pragma/module-comments/contract'
import { aThread } from '@pragma/module-comments/testing'
import { describe, expect, it } from 'vitest'
import { toAnnotations } from '../src/renderer/diff/annotations'
import { openCounts, toAnnotationSide, toDiffSide } from '../src/renderer/lib/comments'

const comment = (id: string, over: Partial<Comment>): Comment =>
  aThread({
    id,
    worktreeId: 'w',
    source: 'diff',
    filePath: 'a.ts',
    lineStart: 1,
    lineEnd: 2,
    diffSide: 'new',
    snippet: undefined,
    language: undefined,
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

  it('an unknown side reads as additions; open code threads per file', () => {
    expect(toAnnotationSide(undefined)).toBe('additions')
    const list = [
      comment('1', {}),
      comment('2', { source: 'editor', diffSide: undefined }),
      comment('3', { status: 'resolved' }),
      comment('4', { filePath: 'b.ts' }),
      comment('5', { source: 'browser', filePath: undefined }),
    ]
    expect(openCounts(list)).toEqual({ 'a.ts': 2, 'b.ts': 1 })
  })

  it('editor threads show on the new side of their file; browser threads never; old-side diff threads stay old', () => {
    const list = [
      comment('ed', { source: 'editor', diffSide: undefined, lineStart: 3, lineEnd: 3 }),
      comment('br', { source: 'browser', filePath: undefined }),
      comment('old', { diffSide: 'old', lineStart: 5, lineEnd: 5 }),
    ]
    const out = toAnnotations(list, null, { path: 'a.ts' })
    expect(out.map((a) => [a.metadata.kind === 'comment' && a.metadata.comment.id, a.side])).toEqual([
      ['ed', 'additions'],
      ['old', 'deletions'],
    ])
  })
})
