import type { CommentAction } from '@pragma/module-editor/contract'
import { describe, expect, it } from 'vitest'
import type { ReplyLike } from '../src/comments/controller'
import type { ThreadInfo } from '../src/comments/threads'
import { answerTestRequest, createTestOps } from '../src/testOps'
import { fakeApi } from './fakes/vscode'

const FOLDER = '/work/repo'
const THREAD: ThreadInfo = {
  id: 'c1',
  path: 'src/bad.ts',
  startLine: 0,
  endLine: 0,
  status: 'open',
  body: 'note',
  replies: [],
}

function setup() {
  const api = fakeApi({ folder: FOLDER })
  const handled: { reply: ReplyLike; action: CommentAction }[] = []
  const calls: unknown[][] = []
  const ops = createTestOps(api, {
    folderPath: () => FOLDER,
    handleComment: async (reply, action) => {
      handled.push({ reply, action })
      reply.thread.addComment(reply.text, 'Not sent')
    },
    handleReply: async (reply, send) => void calls.push(['reply', reply.thread.id, reply.text, send]),
    setStatus: async (id, status) => void calls.push(['setStatus', id, status]),
    threads: () => [THREAD],
  })
  return { api, ops, handled, calls }
}

describe('test ops', () => {
  it('tabs reports webview viewType', () => {
    const { api, ops } = setup()
    api.tabList.push({ label: 'a.ts', kind: 'text' }, { label: 'DB', kind: 'webview', viewType: 'mysql.connection' })
    expect(ops.tabs({})).toEqual(api.tabList)
  })

  it('addComment goes through ReviewController.handle', async () => {
    const { ops, handled } = setup()
    const r = await ops.addComment({ path: 'src/bad.ts', lineStart: 1, lineEnd: 2, body: 'Fix', action: 'send' })
    expect(handled[0]?.action).toBe('send')
    expect(handled[0]?.reply.thread.uri.fsPath).toBe('/work/repo/src/bad.ts')
    expect(handled[0]?.reply.thread.range).toEqual({ startLine: 0, endLine: 1 })
    expect(r).toEqual({ notSent: ['Fix'] })
  })

  it('threads lists what the review controller shows; replyThread and setThreadStatus go through it', async () => {
    const { ops, calls } = setup()
    expect(ops.threads({})).toEqual([THREAD])
    await ops.replyThread({ id: 'c1', body: 'Why?', send: true })
    await ops.setThreadStatus({ id: 'c1', status: 'resolved' })
    expect(calls).toEqual([
      ['reply', 'c1', 'Why?', true],
      ['setStatus', 'c1', 'resolved'],
    ])
  })

  it('diagnostics resolve the path against the folder', () => {
    const { api, ops } = setup()
    api.diags.set('/work/repo/src/bad.ts', [{ severity: 'error', message: 'not assignable', line: 1 }])
    expect(ops.diagnostics({ path: 'src/bad.ts' })).toHaveLength(1)
  })

  it('answerTestRequest replies with result or error', async () => {
    const { ops } = setup()
    const sent: unknown[] = []
    const conn = { request: async (_n: string, p: unknown) => void sent.push(p) } as never
    await answerTestRequest(ops, conn, { requestId: 'r1', op: 'activeEditor', args: null })
    await answerTestRequest(
      {
        ...ops,
        activeEditor: () => {
          throw new Error('boom')
        },
      },
      conn,
      { requestId: 'r2', op: 'activeEditor', args: null },
    )
    expect(sent).toEqual([
      { requestId: 'r1', result: null },
      { requestId: 'r2', error: 'boom' },
    ])
  })
})
