import type { TestBridgeServer } from '@pragma/module-bridge/testing'
import type { Comment } from '@pragma/module-comments/contract'
import { aReply, aThread } from '@pragma/module-comments/testing'
import { afterEach, describe, expect, it } from 'vitest'
import { type EditorLanguageStatus, editorBridge, normalizeFolderKey } from '../src/contract'
import { EditorBridge } from '../src/main/bridge/editorBridge'
import { extensionClient, type FakeUpstream, fakeUpstream, startTestBridgeServer } from './support/fakeUpstream'
import { until } from './support/wait'

const THEME = { themeName: 'Dark Modern', mode: 'dark' as const }
const WT = [
  { id: 'w1', path: '/work/one' },
  { id: 'w2', path: '/work/two' },
]
const cleanups: (() => unknown)[] = []
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c()
})

async function setup() {
  const server: TestBridgeServer = await startTestBridgeServer()
  cleanups.push(() => server.close())
  const up: FakeUpstream = fakeUpstream(server, WT)
  const statuses: [string, EditorLanguageStatus | null][] = []
  const bridge = new EditorBridge(up, {
    theme: () => THEME,
    folderToWorktree: () => undefined,
    onLanguageStatus: (w, s) => statuses.push([w, s]),
  })
  cleanups.push(bridge.register())
  const ext = async (folder: string) => {
    const e = await extensionClient(server, folder)
    cleanups.push(() => e.client.close())
    return e
  }
  return { server, up, bridge, ext, statuses }
}

/** `stored({})` as the bridge sends it (open, pending, no replies). */
const THREAD = {
  source: 'editor',
  filePath: 'src/bad.ts',
  lineStart: 1,
  lineEnd: 1,
  status: 'open',
  pending: true,
  body: 'Pending note',
  replies: [],
}

const comment = (action: 'send' | 'draft') => ({
  action,
  filePath: 'src/bad.ts',
  lineStart: 1,
  lineEnd: 1,
  snippet: 'x',
  body: 'Fix the type',
})

/** A stored draft: an editor comment on `src/bad.ts:1` of w1 unless overridden. */
const stored = (o: Partial<Comment>): Comment =>
  aThread({
    id: 'c',
    worktreeId: 'w1',
    source: 'editor',
    filePath: 'src/bad.ts',
    lineStart: 1,
    lineEnd: undefined,
    snippet: 'x',
    language: undefined,
    body: 'Pending note',
    createdAt: 1,
    updatedAt: 1,
    ...o,
  })

describe('EditorBridge', () => {
  it('hello marks folder ready and replies with theme and worktreeId', async () => {
    const { bridge, ext } = await setup()
    const e = await ext('/work/one')
    expect(await e.hello()).toEqual({ known: true, worktreeId: 'w1', theme: THEME })
    expect(bridge.isReady(e.folderKey)).toBe(true)
  })

  it("openFile before hello waits and is sent only to that folder's client", async () => {
    const { bridge, ext } = await setup()
    const one = await ext('/work/one')
    const two = await ext('/work/two')
    await two.hello()
    const opening = bridge.openFile(one.folderKey, { path: 'a.ts', line: 3 })
    await new Promise((r) => setTimeout(r, 50))
    await one.hello()
    await opening
    await until(() => one.received.length === 1)
    expect(one.received).toEqual([{ name: 'openFile', payload: { path: 'a.ts', line: 3 } }])
    expect(two.received).toEqual([])
  })

  it("openDiff is sent only to that folder's client", async () => {
    const { bridge, ext } = await setup()
    const [one, two] = [await ext('/work/one'), await ext('/work/two')]
    await one.hello()
    await two.hello()
    await bridge.openDiff(two.folderKey, { path: 'b.ts', refs: { old: 'abc', new: 'HEAD' } })
    await until(() => two.received.length === 1)
    expect(two.received).toEqual([{ name: 'openDiff', payload: { path: 'b.ts', refs: { old: 'abc', new: 'HEAD' } } }])
    expect(one.received).toEqual([])
  })

  it('client disconnect clears readiness', async () => {
    const { bridge, ext } = await setup()
    const e = await ext('/work/one')
    await e.hello()
    e.client.close()
    await until(() => !bridge.isReady(e.folderKey))
  })

  it('pushTheme reaches every editor subscriber', async () => {
    const { bridge, ext } = await setup()
    const [a, b] = [await ext('/work/one'), await ext('/work/two')]
    bridge.pushTheme({ themeName: 'Light Modern', mode: 'light' })
    await until(() => a.received.length === 1 && b.received.length === 1)
    expect(a.received[0]).toEqual({ name: 'setTheme', payload: { themeName: 'Light Modern', mode: 'light' } })
  })

  it('openFile times out → rejects notReady', async () => {
    const { bridge } = await setup()
    await expect(bridge.openFile(normalizeFolderKey('/work/one'), { path: 'a' }, 100)).rejects.toThrow('notReady')
  })

  it('comment draft → addDraft with source editor, reply drafted', async () => {
    const { up, ext } = await setup()
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'comment', comment('draft'))).toEqual({
      status: 'drafted',
      commentId: 'c1',
    })
    expect(up.drafts[0]).toMatchObject({
      worktreeId: 'w1',
      source: 'editor',
      filePath: 'src/bad.ts',
      body: 'Fix the type',
    })
    expect(up.sends).toEqual([])
  })

  it.each([
    [
      { status: 'sent', sessionId: 's', round: 1, commentIds: ['c1'], replyIds: [], sentAt: 1 },
      { status: 'sent', commentId: 'c1' },
    ],
    [
      { status: 'needsTarget', sessions: [], defaultSessionId: 's' },
      { status: 'needsUserAction', commentId: 'c1' },
    ],
    [{ status: 'noSession' }, { status: 'needsUserAction', commentId: 'c1' }],
    [
      { status: 'failed', errorKey: 'deliveryFailed' },
      { status: 'failed', message: 'deliveryFailed', commentId: 'c1' },
    ],
  ] as const)('comment send → the worktree round is sent once; %o maps to %o', async (result, reply) => {
    const { up, ext } = await setup()
    up.sendResult = result as FakeUpstream['sendResult']
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'comment', comment('send'))).toEqual(reply)
    expect(up.sends).toEqual(['w1'])
  })

  it('unknown folder → failed message', async () => {
    const { ext } = await setup()
    const e = await ext('/elsewhere')
    expect((await e.hello()).known).toBe(false)
    expect(await e.client.request(editorBridge, 'comment', comment('draft'))).toEqual({
      status: 'failed',
      message: 'This folder is not a Pragma worktree',
    })
  })

  it("threads answers the worktree's editor and new-side diff threads with replies, nothing for an unknown folder", async () => {
    const { up, ext } = await setup()
    up.stored = [
      stored({ id: 'e1', lineStart: 2, lineEnd: 3, round: 1, status: 'resolved' }),
      stored({
        id: 'd1',
        source: 'diff',
        diffSide: 'new',
        lineStart: 4,
        replies: [
          aReply({ id: 'r1', author: 'agent', authorLabel: 'Claude', round: 1, body: 'Done.' }),
          aReply({ id: 'r2', body: 'Thanks.' }),
        ],
      }),
      stored({ id: 'old', source: 'diff', diffSide: 'old' }),
      stored({ id: 'b1', source: 'browser', filePath: undefined, lineStart: undefined }),
      stored({ id: 'f1', lineStart: undefined }),
      stored({ id: 'o1', worktreeId: 'w2' }),
    ]
    const one = await ext('/work/one')
    await one.hello()
    expect(await one.client.request(editorBridge, 'threads', {})).toEqual({
      threads: [
        { ...THREAD, id: 'e1', lineStart: 2, lineEnd: 3, status: 'resolved', pending: false },
        {
          ...THREAD,
          id: 'd1',
          source: 'diff',
          lineStart: 4,
          lineEnd: 4,
          replies: [
            { id: 'r1', author: 'agent', label: 'Claude', body: 'Done.', pending: false },
            { id: 'r2', author: 'user', label: null, body: 'Thanks.', pending: true },
          ],
        },
      ],
    })
    const stranger = await ext('/elsewhere')
    await stranger.hello()
    expect(await stranger.client.request(editorBridge, 'threads', {})).toEqual({ threads: [] })
  })

  it("a comments change pushes the worktree's threads only to that worktree's clients", async () => {
    const { up, ext } = await setup()
    const [one, two] = [await ext('/work/one'), await ext('/work/two')]
    await one.hello()
    await two.hello()
    up.stored = [stored({ id: 'e1' })]
    up.emitCommentsChanged('w1')
    await until(() => one.received.length === 1)
    expect(one.received).toEqual([{ name: 'threads', payload: { threads: [{ ...THREAD, id: 'e1' }] } }])
    up.stored = []
    up.emitCommentsChanged('w1')
    await until(() => one.received.length === 2)
    expect(one.received[1]).toEqual({ name: 'threads', payload: { threads: [] } })
    expect(two.received).toEqual([])
  })

  it('reply adds a user reply; with send it also sends the round once', async () => {
    const { up, ext } = await setup()
    up.stored = [stored({ id: 't1' })]
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'reply', { threadId: 't1', body: 'Why?', send: false })).toEqual({
      status: 'drafted',
      commentId: 't1',
    })
    expect(up.sends).toEqual([])
    expect(await e.client.request(editorBridge, 'reply', { threadId: 't1', body: 'Now.', send: true })).toEqual({
      status: 'sent',
      commentId: 't1',
    })
    expect(up.sends).toEqual(['w1'])
    expect(up.actions).toEqual([
      ['reply', 't1', { author: 'user', body: 'Why?' }],
      ['reply', 't1', { author: 'user', body: 'Now.' }],
    ])
  })

  it('setStatus, deleteThread and send go to the comments service', async () => {
    const { up, ext } = await setup()
    up.stored = [stored({ id: 't1' }), stored({ id: 't2' })]
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'setStatus', { threadId: 't1', status: 'resolved' })).toBeNull()
    expect(await e.client.request(editorBridge, 'deleteThread', { threadId: 't2' })).toBeNull()
    up.sendResult = { status: 'noSession' }
    expect(await e.client.request(editorBridge, 'send', {})).toEqual({ status: 'needsUserAction' })
    expect(up.actions).toEqual([
      ['setStatus', 't1', 'resolved'],
      ['remove', 't2'],
    ])
    expect(up.sends).toEqual(['w1'])
  })

  it('reply, setStatus and deleteThread refuse a thread of another worktree', async () => {
    const { up, ext } = await setup()
    up.stored = [stored({ id: 'o1', worktreeId: 'w2' })]
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'reply', { threadId: 'o1', body: 'Hi.', send: true })).toEqual({
      status: 'failed',
      message: 'This review thread is not in this worktree',
    })
    await expect(e.client.request(editorBridge, 'setStatus', { threadId: 'o1', status: 'resolved' })).rejects.toThrow(
      'This review thread is not in this worktree',
    )
    await expect(e.client.request(editorBridge, 'deleteThread', { threadId: 'o1' })).rejects.toThrow(
      'This review thread is not in this worktree',
    )
    expect(up.actions).toEqual([])
    expect(up.sends).toEqual([])
  })

  it('testRequest resolves on matching testResponse, ignores other requestIds', async () => {
    const { bridge, ext } = await setup()
    const e = await ext('/work/one')
    await e.hello()
    const pending = bridge.testRequest(e.folderKey, 'activeEditor')
    await until(() => e.received.length === 1)
    const req = e.received[0]?.payload as { requestId: string; op: string }
    expect(req.op).toBe('activeEditor')
    await e.client.request(editorBridge, 'testResponse', { requestId: 'other', result: 'nope' })
    await e.client.request(editorBridge, 'testResponse', { requestId: req.requestId, result: { line: 4 } })
    expect(await pending).toEqual({ line: 4 })
  })

  it('resetReady clears readiness', async () => {
    const { bridge, ext } = await setup()
    const e = await ext('/work/one')
    await e.hello()
    bridge.resetReady()
    expect(bridge.isReady(e.folderKey)).toBe(false)
  })

  it('languageStatus publishes for the client worktree; disconnect publishes null', async () => {
    const { ext, statuses } = await setup()
    const e = await ext('/work/two')
    await e.hello()
    const status = { languageId: 'typescript', state: 'problems' as const, errors: 1, warnings: 0 }
    await e.client.request(editorBridge, 'languageStatus', status)
    expect(statuses).toEqual([['w2', status]])
    e.client.close()
    await until(() => statuses.length === 2)
    expect(statuses[1]).toEqual(['w2', null])
  })
})
