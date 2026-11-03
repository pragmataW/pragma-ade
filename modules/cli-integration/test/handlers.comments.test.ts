import { aSession } from '@pragma/module-agents/testing'
import { aReply } from '@pragma/module-comments/testing'
import { describe, expect, it } from 'vitest'
import { createCliHandlers } from '../src/main/handlers'
import { aComment, context, fakeAgents, fakeComments, makeDeps } from './support/fakes'

const wt = context({ worktreeId: 'w1' })

function setup() {
  const comments = fakeComments([
    aComment('c1', { lineStart: 2, replies: [aReply({ commentId: 'c1', body: 'Draft.' })] }),
    aComment('c2', { status: 'resolved', resolvedAt: 5 }),
    aComment('draft', { round: undefined }),
    aComment('other', { worktreeId: 'w2' }),
  ])
  const agents = fakeAgents({ sessions: [aSession('s1', 1, { profileId: 'claude' })] })
  return { comments, h: createCliHandlers(makeDeps({ comments, agents })) }
}

describe('comments list', () => {
  it('defaults to open, delivered threads with their text and the round', async () => {
    const { h } = setup()
    const res = await h.commentsList({ context: wt })
    expect(res).toMatchObject({
      ok: true,
      result: {
        worktreeId: 'w1',
        round: 1,
        status: 'open',
        comments: [{ id: 'c1', status: 'open', lineStart: 2, lineEnd: null, replies: [], text: 'text:c1@1' }],
      },
    })
  })

  it('--status all includes resolved threads, never pending drafts', async () => {
    const { h } = setup()
    const res = await h.commentsList({ context: wt, status: 'all' })
    expect(res.ok && (res.result as { comments: { id: string }[] }).comments.map((c) => c.id)).toEqual(['c1', 'c2'])
  })
})

describe('thread actions', () => {
  it('show returns one thread; an unknown or pending id → not_found', async () => {
    const { h } = setup()
    expect(await h.commentsShow({ context: wt, commentId: 'c2' })).toMatchObject({
      ok: true,
      result: { id: 'c2', status: 'resolved', resolvedAt: 5, text: 'text:c2@1' },
    })
    for (const commentId of ['nope', 'draft'])
      expect(await h.commentsShow({ context: wt, commentId })).toMatchObject({
        ok: false,
        error: { code: 'not_found' },
      })
  })

  it('reply is an agent reply labelled with the caller session profile', async () => {
    const { h, comments } = setup()
    const res = await h.commentsReply({ context: { ...wt, sessionId: 's1' }, commentId: 'c1', body: 'Done.' })
    expect(comments.calls).toEqual([
      ['reply', 'c1', { author: 'agent', body: 'Done.', sessionId: 's1', authorLabel: 'Claude' }],
    ])
    expect(res).toMatchObject({ ok: true, result: { id: 'c1', replies: [{ author: 'agent', authorLabel: 'Claude' }] } })
  })

  it('reply with a document and without a session', async () => {
    const { h, comments } = setup()
    await h.commentsReply({ context: wt, commentId: 'c1', document: 'Long\nreply.' })
    expect(comments.calls).toEqual([['reply', 'c1', { author: 'agent', body: 'Long\nreply.' }]])
  })

  it('reply needs exactly one of body and document', async () => {
    const { h } = setup()
    for (const extra of [{}, { body: 'a', document: 'b' }])
      expect(await h.commentsReply({ context: wt, commentId: 'c1', ...extra })).toMatchObject({
        ok: false,
        error: { code: 'invalid_argument' },
      })
  })

  it('resolve with a closing body, reopen without', async () => {
    const { h, comments } = setup()
    expect(await h.commentsResolve({ context: wt, commentId: 'c1', body: 'Fixed.' })).toMatchObject({
      ok: true,
      result: { id: 'c1', status: 'resolved' },
    })
    expect(await h.commentsReopen({ context: wt, commentId: 'c2' })).toMatchObject({
      ok: true,
      result: { id: 'c2', status: 'open' },
    })
    expect(comments.calls).toEqual([
      ['setStatus', 'c1', 'resolved', { author: 'agent', body: 'Fixed.' }],
      ['setStatus', 'c2', 'open', undefined],
    ])
  })

  it('a pending thread cannot be replied to or resolved', async () => {
    const { h } = setup()
    expect(await h.commentsResolve({ context: wt, commentId: 'draft' })).toMatchObject({
      ok: false,
      error: { code: 'not_found' },
    })
  })
})
