import { afterEach, expect, it, test } from 'vitest'
import { COMMENTS_COMMANDS, commentsIpc, type SendResult } from '../../src/contract'
import { createSendFlow } from '../../src/renderer/use-send-flow'
import { WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'

let r: MountedRenderer | undefined
afterEach(() => r?.stop())
const SENT: SendResult = { status: 'sent', sessionId: 'a', round: 1, commentIds: ['c'], replyIds: [], sentAt: 1 }
const SESSIONS = [
  { id: 'a', title: 'A', mode: 'terminal', status: 'idle' },
  { id: 'b', title: 'B', mode: 'terminal', status: 'idle' },
]

it.each<[string, SendResult, boolean, string]>([
  ['single', SENT, true, 'none'],
  ['choose', { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' }, false, 'picker'],
  ['none', { status: 'noSession' }, false, 'launch'],
])('send flow: %s', async (_n, result, settles, dialog) => {
  r = mountRenderer()
  r.init()
  r.fakeIpc.respond(commentsIpc.send, () => result)
  const out = await createSendFlow(r, r.store).send()
  expect(out).toEqual(settles ? result : undefined)
  const s = r.store.getState()
  expect(s.targetPicker ? 'picker' : s.launchSuggestion ? 'launch' : 'none').toBe(dialog)
  expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ worktreeId: WT }])
})

test('preferredSessionId becomes the picker default', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' }))
  await createSendFlow(r, r.store).send({ worktreeId: WT, preferredSessionId: 'b' })
  expect(r.store.getState().targetPicker?.defaultSessionId).toBe('b')
})

test('sendTo passes the target', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.send, () => SENT)
  await createSendFlow(r, r.store).sendTo(WT, 'b')
  expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ worktreeId: WT, targetSessionId: 'b' }])
})

test('startAgentAndSend calls sendOnNextSession then agents.openLauncher {worktreeId}', async () => {
  r = mountRenderer()
  r.store.getState().applyResult(WT, { status: 'noSession' })
  await createSendFlow(r, r.store).startAgentAndSend(WT)
  expect(r.fakeIpc.calls).toEqual([[commentsIpc.sendOnNextSession.channel, { worktreeId: WT }]])
  expect(r.executed).toEqual([['agents.openLauncher', { worktreeId: WT }]])
  expect(r.store.getState().launchSuggestion?.waiting).toBe(true)
  expect(COMMENTS_COMMANDS.openDrawer).toBe('comments.openDrawer')
})

test('cancelLaunch cancels the pending entry', async () => {
  r = mountRenderer()
  r.store.getState().applyResult(WT, { status: 'noSession' })
  await createSendFlow(r, r.store).cancelLaunch(WT)
  expect(r.store.getState().launchSuggestion).toBeNull()
  expect(r.fakeIpc.callsOn(commentsIpc.cancelPending.channel)).toEqual([{ worktreeId: WT }])
})
