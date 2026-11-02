import { describe, expect, it } from 'vitest'
import { buildCommentPayload, type CommentPayloadInput, languageHint } from '../src/comments/payload'

const LINES = ['line 1', 'line 2', 'export const x: number = "a"', 'line 4', 'line 5', 'line 6']
const base: CommentPayloadInput = {
  folderPath: '/work/repo',
  docPath: '/work/repo/src/bad.ts',
  docScheme: 'file',
  startLine0: 2,
  endLine0: 2,
  lineTexts: LINES,
  languageId: 'typescript',
  body: '  Fix the type  ',
  action: 'send',
}

describe('buildCommentPayload', () => {
  it('payload single line: src/bad.ts:3-3, snippet is line 3', () => {
    expect(buildCommentPayload(base)).toEqual({
      ok: true,
      payload: {
        action: 'send',
        filePath: 'src/bad.ts',
        lineStart: 3,
        lineEnd: 3,
        snippet: LINES[2],
        body: 'Fix the type',
      },
    })
  })

  it('payload multi-line range 2..5 joins with \\n', () => {
    const r = buildCommentPayload({ ...base, startLine0: 1, endLine0: 4, action: 'draft' })
    expect(r).toMatchObject({ ok: true, payload: { lineStart: 2, lineEnd: 5, snippet: LINES.slice(1, 5).join('\n') } })
  })

  it.each([
    [
      'files outside the workspace folder',
      { docPath: '/work/other/a.ts' },
      'Only files in this worktree can be commented',
    ],
    ['untitled', { docScheme: 'untitled', docPath: 'Untitled-1' }, 'Only files in this worktree can be commented'],
    ['empty body', { body: '   ' }, 'Comment is empty'],
  ] as const)('returns error for %s', (_label, over, message) => {
    expect(buildCommentPayload({ ...base, ...over })).toEqual({ ok: false, message })
  })

  it('languageHint', () => {
    expect(languageHint('Makefile', 'makefile')).toBe('makefile')
    expect(languageHint('a.ts', 'typescript')).toBeUndefined()
    expect(languageHint('LICENSE', 'plaintext')).toBeUndefined()
  })
})
