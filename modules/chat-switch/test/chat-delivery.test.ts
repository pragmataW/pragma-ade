import type { Comment, DeliveryRequest } from '@pragma/module-comments/contract'
import { describe, expect, it } from 'vitest'
import { activateChatSwitch } from '../src/main/activate'
import { chipLabelFor, createChatDelivery } from '../src/main/chat-delivery'
import {
  fakeAgents,
  fakeChat,
  fakeComments,
  fakeEvents,
  fakeIpc,
  fakeProviders,
  SESSION_ID,
  silentLog,
} from './support'

const comment = (patch: Partial<Comment>): Comment =>
  ({ id: 'c', worktreeId: 'w1', source: 'diff', body: 'b', createdAt: 1, updatedAt: 1, ...patch }) as Comment
const ELEMENT = {
  url: 'http://x',
  selector: 'button.btn-primary',
  outerHtml: '<button/>',
  boundingBox: { x: 0, y: 0, width: 1, height: 1 },
}

const request = (comments: Comment[], submit: boolean): DeliveryRequest => ({
  sessionId: SESSION_ID,
  worktreeId: 'w1',
  mode: 'chat',
  ptyId: null,
  text: 'Review comments:\n1. src/a.ts:3 fix',
  comments,
  submit,
})

describe('chat comment delivery', () => {
  it.each([
    [{ filePath: 'src/a.ts', lineStart: 3, lineEnd: 7 }, 'src/a.ts:3-7'],
    [{ filePath: 'src/a.ts', lineStart: 3, lineEnd: 3 }, 'src/a.ts:3'],
    [{ filePath: 'src/a.ts', lineStart: 3 }, 'src/a.ts:3'],
    [{ filePath: 'src/a.ts' }, 'src/a.ts'],
    [{ source: 'browser' as const, element: ELEMENT }, 'button.btn-primary'],
  ])('chipLabelFor(%j) = %s', (patch, label) => expect(chipLabelFor(comment(patch))).toBe(label))

  it.each([true, false])(
    "delivers 05's text unchanged with one label per comment (submit=%s ignored)",
    async (submit) => {
      const chat = fakeChat()
      const req = request([comment({ filePath: 'src/a.ts', lineStart: 3 }), comment({ filePath: 'b.ts' })], submit)
      await createChatDelivery(chat)(req)
      expect(chat.appends).toEqual([
        { sessionId: SESSION_ID, text: req.text, opts: { chipLabels: ['src/a.ts:3', 'b.ts'] } },
      ])
    },
  )

  it("registered under mode 'chat'", () => {
    const comments = fakeComments()
    activateChatSwitch({
      agents: fakeAgents(),
      chat: fakeChat(),
      comments,
      providers: fakeProviders(),
      events: fakeEvents(),
      ipc: fakeIpc(),
      worktreePath: async () => null,
      provide: () => undefined,
      log: silentLog(),
    })
    expect(comments.registerDeliveryTarget).toHaveBeenCalledWith('chat', expect.any(Function))
  })
})
