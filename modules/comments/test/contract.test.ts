import { describe, expect, it, test } from 'vitest'
import {
  COMMENTS_TESTIDS,
  CommentInputSchema,
  CommentsServiceToken,
  CommentsSettingsSchema,
  CommentsUiServiceToken,
  type SendResult,
  SendResultSchema,
} from '../src/contract'
import { makeInput } from './factories'

describe('CommentInputSchema', () => {
  test('normalises CRLF, backslashes and trims body', () => {
    const r = CommentInputSchema.parse(makeInput({ filePath: 'src\\a.ts', snippet: 'a\r\nb', body: ' fix ' }))
    expect([r.filePath, r.snippet, r.body]).toEqual(['src/a.ts', 'a\nb', 'fix'])
  })
  it.each([
    ['whitespace body', { body: '   ' }],
    ['lineEnd < lineStart', { lineStart: 5, lineEnd: 3 }],
    ['lineEnd without lineStart', { lineStart: undefined, lineEnd: 3 }],
    ['diff without filePath', { filePath: undefined }],
    ['browser without element', { source: 'browser' as const, element: undefined }],
  ])('rejects %s', (_n, o) => expect(() => CommentInputSchema.parse(makeInput(o))).toThrow())
})

test('settings default', () => expect(CommentsSettingsSchema.parse({})).toEqual({ submitAfterPaste: true }))

const RESULTS: SendResult[] = [
  { status: 'sent', sessionId: 's1', commentIds: ['c1'], sentAt: 1 },
  {
    status: 'needsTarget',
    sessions: [{ id: 's1', title: 'A', mode: 'terminal', status: 'idle' }],
    defaultSessionId: 's1',
  },
  { status: 'noSession' },
  { status: 'failed', errorKey: 'agentNotReady' },
]
it.each(RESULTS.map((r) => [r.status, r]))('SendResult schema accepts %s', (_s, r) =>
  expect(SendResultSchema.parse(r)).toEqual(r),
)

test('tokens', () => {
  expect(CommentsServiceToken.id).toBe('comments.service')
  expect(CommentsUiServiceToken.id).toBe('comments.ui')
})

test('testids are unique', () =>
  expect(new Set(Object.values(COMMENTS_TESTIDS)).size).toBe(Object.keys(COMMENTS_TESTIDS).length))
