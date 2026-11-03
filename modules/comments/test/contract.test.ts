import { describe, expect, it, test } from 'vitest'
import {
  COMMENTS_TESTIDS,
  CommentInputSchema,
  CommentSchema,
  CommentsServiceToken,
  CommentsSettingsSchema,
  CommentsUiServiceToken,
  commentContextOf,
  isCodeThread,
  isPendingReply,
  isPendingRoot,
  pendingCount,
  pendingItems,
  type SendResult,
  SendResultSchema,
  visibleToAgent,
} from '../src/contract'
import { aReply, aThread } from '../src/testing'
import { makeComment, makeInput } from './factories'

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

test('commentContextOf keeps the anchor and drops body, ids and timestamps', () => {
  const c = makeComment({ diffSide: 'new' })
  const { source, filePath, lineStart, lineEnd, snippet, language } = c
  expect(commentContextOf(c)).toEqual({ source, filePath, lineStart, lineEnd, diffSide: 'new', snippet, language })
})

test('settings default', () => expect(CommentsSettingsSchema.parse({})).toEqual({ submitAfterPaste: true }))

const RESULTS: SendResult[] = [
  { status: 'sent', sessionId: 's1', round: 1, commentIds: ['c1'], replyIds: ['r1'], sentAt: 1 },
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

describe('thread helpers', () => {
  const delivered = aThread({ id: 'a', round: 1 })
  const pendingRoot = aThread({ id: 'b' })
  const withReplies = aThread({
    id: 'c',
    round: 1,
    replies: [
      aReply({ id: 'r1', commentId: 'c', author: 'agent', round: 1 }),
      aReply({ id: 'r2', commentId: 'c', author: 'user', round: 1 }),
      aReply({ id: 'r3', commentId: 'c', author: 'user' }),
    ],
  })

  test('pending roots and user replies', () => {
    expect([isPendingRoot(delivered), isPendingRoot(pendingRoot)]).toEqual([false, true])
    expect(withReplies.replies.map(isPendingReply)).toEqual([false, false, true])
    expect(pendingItems([delivered, pendingRoot, withReplies])).toEqual({ commentIds: ['b'], replyIds: ['r3'] })
    expect(pendingCount([delivered, pendingRoot, withReplies])).toBe(2)
  })

  test('an agent reply without a round is never pending', () =>
    expect(isPendingReply(aReply({ author: 'agent' }))).toBe(false))

  it.each([
    ['editor', { source: 'editor' as const }, true],
    ['diff new', { source: 'diff' as const, diffSide: 'new' as const }, true],
    ['diff without side', { source: 'diff' as const, diffSide: undefined }, true],
    ['diff old', { source: 'diff' as const, diffSide: 'old' as const }, false],
    ['browser', { source: 'browser' as const, filePath: undefined }, false],
  ])('isCodeThread: %s', (_n, o, want) => expect(isCodeThread(aThread(o))).toBe(want))

  test('visibleToAgent hides pending roots and pending replies', () => {
    expect(visibleToAgent(pendingRoot)).toBeUndefined()
    expect(visibleToAgent(withReplies)?.replies.map((r) => r.id)).toEqual(['r1', 'r2'])
  })

  test('CommentSchema accepts a thread with replies', () =>
    expect(CommentSchema.parse(withReplies)).toEqual(withReplies))
})
