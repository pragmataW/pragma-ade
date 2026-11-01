import type { TestBridgeServer } from '@pragma/module-bridge/testing'
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

const comment = (action: 'send' | 'draft') => ({
  action,
  filePath: 'src/bad.ts',
  lineStart: 1,
  lineEnd: 1,
  snippet: 'x',
  body: 'Fix the type',
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
      { status: 'sent', sessionId: 's', commentIds: ['c1'], sentAt: 1 },
      { status: 'sent', commentId: 'c1' },
    ],
    [
      { status: 'needsTarget', sessions: [], defaultSessionId: 's' },
      { status: 'needsUserAction', commentId: 'c1' },
    ],
    [{ status: 'noSession' }, { status: 'needsUserAction', commentId: 'c1' }],
    [
      { status: 'failed', errorKey: 'deliveryFailed' },
      { status: 'failed', message: 'deliveryFailed' },
    ],
  ] as const)('comment send → %o maps to %o and the draft is kept', async (result, reply) => {
    const { up, ext } = await setup()
    up.sendResult = result as FakeUpstream['sendResult']
    const e = await ext('/work/one')
    await e.hello()
    expect(await e.client.request(editorBridge, 'comment', comment('send'))).toEqual(reply)
    expect(up.sends).toEqual([['c1']])
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
