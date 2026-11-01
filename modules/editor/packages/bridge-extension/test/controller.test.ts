import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EditorComment, EditorCommentReply } from '@pragma/module-editor/contract'
import { describe, expect, it } from 'vitest'
import { type CommentConnection, ReviewController } from '../src/comments/controller'
import { COMMANDS, CONTROLLER } from '../src/constants'
import { fakeApi, fakeThread } from './fakes/vscode'

const FOLDER = '/work/repo'
const FILE = '/work/repo/src/bad.ts'

function setup(reply: EditorCommentReply | Error) {
  const api = fakeApi({ folder: FOLDER })
  api.documents.set(FILE, { lines: ['a', 'b', 'c'], languageId: 'typescript' })
  const requests: EditorComment[] = []
  const conn = {
    folderPath: FOLDER,
    request: async (_name: string, payload: EditorComment) => {
      requests.push(payload)
      if (reply instanceof Error) throw reply
      return reply
    },
  } as unknown as CommentConnection
  const controller = new ReviewController(api, conn)
  controller.register()
  return { api, controller, requests }
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

  it('manifest command ids match constants', () => {
    const pkg = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'package.json'), 'utf8'))
    const ids = pkg.contributes.commands.map((c: { command: string }) => c.command).sort()
    expect(ids).toEqual(Object.values(COMMANDS).sort())
    const menu = pkg.contributes.menus['comments/commentThread/context']
    expect(menu.every((m: { when: string }) => m.when === `commentController == ${CONTROLLER.id}`)).toBe(true)
  })
})
