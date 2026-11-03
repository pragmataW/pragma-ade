import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EditorComment, EditorCommentReply, EditorThread } from '@pragma/module-editor/contract'
import { describe, expect, it } from 'vitest'
import { type CommentConnection, ReviewController } from '../src/comments/controller'
import { COMMANDS, CONTROLLER, THREAD_CONTEXT } from '../src/constants'
import { fakeApi, fakeThread } from './fakes/vscode'

const FOLDER = '/work/repo'
const FILE = '/work/repo/src/bad.ts'

const draft = (id: string, o: Partial<EditorThread> = {}): EditorThread => ({
  id,
  source: 'editor',
  filePath: 'src/bad.ts',
  lineStart: 1,
  lineEnd: 1,
  status: 'open',
  pending: true,
  body: `note ${id}`,
  replies: [],
  ...o,
})
/** What the `threads` request answers. */
let stored: EditorThread[] = []
const bodies = (t: { comments: { body: string }[] }) => t.comments.map((c) => c.body)

function setup(reply: EditorCommentReply | Error) {
  const api = fakeApi({ folder: FOLDER })
  api.documents.set(FILE, { lines: ['a', 'b', 'c'], languageId: 'typescript' })
  const requests: EditorComment[] = []
  const calls: [string, unknown][] = []
  const conn = {
    folderPath: FOLDER,
    request: async (name: string, payload: EditorComment) => {
      if (name === 'threads') return { threads: stored }
      if (name !== 'comment') {
        calls.push([name, payload])
        return name === 'reply' ? reply : null
      }
      requests.push(payload)
      if (reply instanceof Error) throw reply
      return reply
    },
  } as unknown as CommentConnection
  const controller = new ReviewController(api, conn)
  controller.register()
  return { api, controller, requests, calls }
}

describe('ReviewController', () => {
  it.each([
    ['send', COMMANDS.sendToAgent, { status: 'sent', commentId: 'c1' }, 'Sent to agent', true],
    ['draft', COMMANDS.addToReview, { status: 'drafted', commentId: 'c1' }, 'Added to review', true],
    ['send', COMMANDS.sendToAgent, { status: 'needsUserAction', commentId: 'c1' }, 'Choose an agent in Pragma', true],
    ['send', COMMANDS.sendToAgent, { status: 'failed', message: 'comments:errors.deliveryFailed' }, null, false],
    ['send', COMMANDS.sendToAgent, new Error('offline'), null, false],
  ] as const)('%s via %s → %o', async (action, command, reply, info, disposed) => {
    const { api, requests } = setup(reply as EditorCommentReply | Error)
    const t = fakeThread(FILE, 0, 0)
    await api.commands.get(command)?.({ thread: t.thread, text: 'Fix the type' })
    expect(requests[0]).toMatchObject({
      action,
      filePath: 'src/bad.ts',
      lineStart: 1,
      lineEnd: 1,
      body: 'Fix the type',
    })
    expect(t.isDisposed()).toBe(disposed)
    if (info) expect(api.infos).toEqual([info])
    else {
      expect(api.warnings).toHaveLength(1)
      expect(t.added).toEqual([{ body: 'Fix the type', label: 'Not sent' }])
    }
  })

  it('a failed send whose draft was stored warns and leaves only the Pending thread', async () => {
    const { api } = setup({ status: 'failed', message: 'comments:errors.deliveryFailed', commentId: 'c1' })
    const t = fakeThread(FILE, 0, 0)
    await api.commands.get(COMMANDS.sendToAgent)?.({ thread: t.thread, text: 'Fix the type' })
    expect(api.warnings).toEqual(['comments:errors.deliveryFailed'])
    expect(t.isDisposed()).toBe(true)
    expect(t.added).toEqual([])
  })

  it('cancel disposes the thread', async () => {
    const { api } = setup({ status: 'sent', commentId: 'c' })
    const t = fakeThread(FILE, 0, 0)
    await api.commands.get(COMMANDS.cancel)?.({ thread: t.thread, text: '' })
    expect(t.isDisposed()).toBe(true)
  })

  it('commenting ranges cover whole file for file scheme inside folder, none outside', () => {
    const { controller, api } = setup({ status: 'sent', commentId: 'c' })
    expect(api.controllers[0]?.id).toBe(CONTROLLER.id)
    expect(controller.ranges({ scheme: 'file', fsPath: FILE, lineCount: 60 })).toEqual([[0, 59]])
    expect(controller.ranges({ scheme: 'file', fsPath: '/elsewhere/a.ts', lineCount: 3 })).toEqual([])
    expect(controller.ranges({ scheme: 'untitled', fsPath: 'Untitled-1', lineCount: 3 })).toEqual([])
  })

  it('draws each thread with its replies, authors and Pending labels on 0-based lines of the absolute file', () => {
    const { api, controller } = setup({ status: 'sent', commentId: 'c' })
    const replies = [
      { id: 'r1', author: 'agent', label: 'Claude', body: 'Done.', pending: false },
      { id: 'r2', author: 'agent', label: null, body: 'Also.', pending: false },
      { id: 'r3', author: 'user', label: null, body: 'Thanks.', pending: true },
    ] as const
    controller.showThreads([draft('a', { lineStart: 2, lineEnd: 4, pending: false, replies: [...replies] })])
    expect(api.threads).toEqual([
      {
        id: 'a',
        path: '/work/repo/src/bad.ts',
        startLine: 1,
        endLine: 3,
        comments: [
          { body: 'note a', author: 'You' },
          { body: 'Done.', author: 'Claude' },
          { body: 'Also.', author: 'Agent' },
          { body: 'Thanks.', author: 'You', label: 'Pending' },
        ],
        resolved: false,
        contextValue: THREAD_CONTEXT.open,
        disposed: false,
        updates: 0,
      },
    ])
    expect(controller.threads()[0]).toMatchObject({ id: 'a', path: 'src/bad.ts', startLine: 1, status: 'open' })
  })

  it('a resolved thread is drawn Resolved with the resolved context', () => {
    const { api, controller } = setup({ status: 'sent', commentId: 'c' })
    controller.showThreads([draft('a', { status: 'resolved', pending: false })])
    expect(api.threads[0]).toMatchObject({ resolved: true, contextValue: THREAD_CONTEXT.resolved })
    expect(api.threads[0]?.comments[0]).toEqual({ body: 'note a', author: 'You' })
  })

  it('a newer list removes deleted threads, keeps unchanged ones and updates changed ones in place', () => {
    const { api, controller } = setup({ status: 'sent', commentId: 'c' })
    controller.showThreads([draft('a'), draft('b'), draft('c')])
    controller.showThreads([draft('a'), draft('c', { status: 'resolved' })])
    expect(api.threads).toHaveLength(3)
    expect(api.threads.map((t) => [t.id, t.disposed, t.updates])).toEqual([
      ['a', false, 0],
      ['b', true, 0],
      ['c', false, 1],
    ])
    expect(api.threads[2]?.resolved).toBe(true)
    expect(controller.threads().map((d) => d.id)).toEqual(['a', 'c'])
    controller.showThreads([])
    expect(api.threads.every((t) => t.disposed)).toBe(true)
  })

  it('threads that arrive before register are drawn on register; dispose removes them', () => {
    const api = fakeApi({ folder: FOLDER })
    const conn = { folderPath: FOLDER, request: async () => ({}) } as unknown as CommentConnection
    const controller = new ReviewController(api, conn)
    controller.showThreads([draft('a')])
    expect(api.threads).toEqual([])
    controller.register()
    expect(api.threads.map(bodies)).toEqual([['note a']])
    controller.dispose()
    expect(api.threads[0]?.disposed).toBe(true)
  })

  it('refresh asks the bridge for the threads and shows them', async () => {
    const { api, controller } = setup({ status: 'sent', commentId: 'c' })
    stored = [draft('a'), draft('b', { filePath: 'src/long.ts', lineStart: 7, lineEnd: 7 })]
    await controller.refresh()
    stored = []
    expect(api.threads.map((t) => [t.path, t.startLine])).toEqual([
      ['/work/repo/src/bad.ts', 0],
      ['/work/repo/src/long.ts', 6],
    ])
  })

  it.each([
    [COMMANDS.reply, false, 'Reply added'],
    [COMMANDS.replyAndSend, true, 'Sent to agent'],
  ])('%s sends a reply for the thread (send: %s) and disposes nothing', async (command, send, info) => {
    const { api, calls } = setup(send ? { status: 'sent', commentId: 'a' } : { status: 'drafted', commentId: 'a' })
    const t = fakeThread(FILE, 0, 0)
    await api.commands.get(command)?.({ thread: { ...t.thread, id: 'a' }, text: 'Why?' })
    expect(calls).toEqual([['reply', { threadId: 'a', body: 'Why?', send }]])
    expect(api.infos).toEqual([info])
    expect(t.isDisposed()).toBe(false)
  })

  it('a reply on a thread Pragma does not know warns and sends nothing', async () => {
    const { api, calls } = setup({ status: 'drafted', commentId: 'a' })
    await api.commands.get(COMMANDS.reply)?.({ thread: fakeThread(FILE, 0, 0).thread, text: 'x' })
    expect(calls).toEqual([])
    expect(api.warnings).toHaveLength(1)
  })

  it.each([
    [COMMANDS.resolve, 'setStatus', { threadId: 'a', status: 'resolved' }],
    [COMMANDS.reopen, 'setStatus', { threadId: 'a', status: 'open' }],
    [COMMANDS.deleteThread, 'deleteThread', { threadId: 'a' }],
  ])('%s sends %s', async (command, name, payload) => {
    const { api, calls } = setup({ status: 'sent', commentId: 'c' })
    await api.threadCommands.get(command)?.('a')
    expect(calls).toEqual([[name, payload]])
  })

  it('manifest command ids match constants', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
    const ids = pkg.contributes.commands.map((c: { command: string }) => c.command).sort()
    expect(ids).toEqual(Object.values(COMMANDS).sort())
    const controller = `commentController == ${CONTROLLER.id}`
    const menus = pkg.contributes.menus
    const when = (key: string) => menus[key].map((m: { command: string; when: string }) => [m.command, m.when])
    expect(when('comments/commentThread/context')).toEqual([
      [COMMANDS.sendToAgent, `${controller} && commentThreadIsEmpty`],
      [COMMANDS.addToReview, `${controller} && commentThreadIsEmpty`],
      [COMMANDS.cancel, `${controller} && commentThreadIsEmpty`],
      [COMMANDS.replyAndSend, `${controller} && !commentThreadIsEmpty`],
      [COMMANDS.reply, `${controller} && !commentThreadIsEmpty`],
    ])
    expect(when('comments/commentThread/title')).toEqual([
      [COMMANDS.resolve, `${controller} && commentThread == ${THREAD_CONTEXT.open}`],
      [COMMANDS.reopen, `${controller} && commentThread == ${THREAD_CONTEXT.resolved}`],
      [COMMANDS.deleteThread, controller],
    ])
    expect(menus.commandPalette.map((m: { command: string }) => m.command).sort()).toEqual(ids)
  })
})
