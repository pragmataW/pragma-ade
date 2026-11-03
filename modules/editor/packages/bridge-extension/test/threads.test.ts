import type { EditorThread } from '@pragma/module-editor/contract'
import { describe, expect, it } from 'vitest'
import { toThreadInfo, toThreadSpec } from '../src/comments/threads'
import { COMMENT_CONTEXT, THREAD_CONTEXT } from '../src/constants'

const thread = (o: Partial<EditorThread> = {}): EditorThread => ({
  id: 't',
  source: 'editor',
  filePath: 'src/a.ts',
  lineStart: 3,
  lineEnd: 3,
  status: 'open',
  pending: false,
  body: 'Fix it',
  createdAt: 1_000,
  replies: [],
  ...o,
})

describe('toThreadSpec', () => {
  it.each([
    [{}, 'L3 · Open'],
    [{ lineEnd: 5 }, 'L3–5 · Open'],
    [{ pending: true }, 'L3 · Open · Pending'],
    [{ status: 'resolved' as const }, 'L3 · Resolved'],
  ])('%o is labelled %s', (o, label) => {
    expect(toThreadSpec('/w', thread(o)).label).toBe(label)
  })

  it('the root is You with its time; replies carry their author, time and Pending marker', () => {
    const spec = toThreadSpec(
      '/w',
      thread({
        pending: true,
        replies: [
          { id: 'r1', author: 'agent', label: 'Claude', body: 'Done.', pending: false, createdAt: 2_000 },
          { id: 'r2', author: 'agent', label: null, body: 'Also.', pending: false, createdAt: 3_000 },
          { id: 'r3', author: 'user', label: null, body: 'Thanks.', pending: true, createdAt: 4_000 },
        ],
      }),
    )
    expect(spec.comments).toEqual([
      { body: 'Fix it', author: 'You', label: 'Pending', timestamp: 1_000, contextValue: COMMENT_CONTEXT.pending },
      { body: 'Done.', author: 'Claude', timestamp: 2_000, contextValue: COMMENT_CONTEXT.sent },
      { body: 'Also.', author: 'Agent', timestamp: 3_000, contextValue: COMMENT_CONTEXT.sent },
      { body: 'Thanks.', author: 'You', label: 'Pending', timestamp: 4_000, contextValue: COMMENT_CONTEXT.pending },
    ])
    expect(spec).toMatchObject({ path: '/w/src/a.ts', startLine: 2, endLine: 2, contextValue: THREAD_CONTEXT.open })
  })

  it('a resolved thread has the resolved context', () => {
    expect(toThreadSpec('/w', thread({ status: 'resolved' }))).toMatchObject({
      resolved: true,
      contextValue: THREAD_CONTEXT.resolved,
    })
  })

  it('the test view of a thread has its label and the replies with their Pending flag', () => {
    const info = toThreadInfo(
      thread({ replies: [{ id: 'r', author: 'user', label: null, body: 'x', pending: true, createdAt: 1 }] }),
    )
    expect(info).toMatchObject({ label: 'L3 · Open', replies: [{ author: 'You', body: 'x', pending: true }] })
  })
})
