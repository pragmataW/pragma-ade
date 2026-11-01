import { afterEach, expect, it, test } from 'vitest'
import { COMMENTS_COMMANDS, commentsIpc, type SendResult } from '../../src/contract'
import { createSendFlow } from '../../src/renderer/use-send-flow'
import { WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'

let r: MountedRenderer | undefined
afterEach(() => r?.stop())
const SESSIONS = [
  { id: 'a', title: 'A', mode: 'terminal', status: 'idle' },
  { id: 'b', title: 'B', mode: 'terminal', status: 'idle' },
]

it.each<[string, SendResult, boolean, string]>([
  ['single', { status: 'sent', sessionId: 'a', commentIds: ['c'], sentAt: 1 }, true, 'none'],
  ['choose', { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' }, false, 'picker'],
  ['none', { status: 'noSession' }, false, 'launch'],
])('send flow: %s', async (_n, result, settles, dialog) => {
  r = mountRenderer()
  r.init()
  r.fakeIpc.respond(commentsIpc.send, () => result)
  const out = await createSendFlow(r, r.store).send(['c'])
  expect(out).toEqual(settles ? result : undefined)
  const s = r.store.getState()
  expect(s.targetPicker ? 'picker' : s.launchSuggestion ? 'launch' : 'none').toBe(dialog)
})

test('preferredSessionId becomes the picker default', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' }))
  await createSendFlow(r, r.store).send(['c'], { preferredSessionId: 'b' })
  expect(r.store.getState().targetPicker?.defaultSessionId).toBe('b')
})

test('sendTo passes the target', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'sent', sessionId: 'b', commentIds: ['c'], sentAt: 1 }))
  await createSendFlow(r, r.store).sendTo(['c'], 'b')
  expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ commentIds: ['c'], targetSessionId: 'b' }])
})

test('startAgentAndSend calls sendOnNextSession then agents.openLauncher {worktreeId}', async () => {
  r = mountRenderer()
  r.store.getState().applyResult(WT, ['c'], { status: 'noSession' })
  await createSendFlow(r, r.store).startAgentAndSend(WT, ['c'])
  expect(r.fakeIpc.calls.map(([c]) => c)).toEqual([commentsIpc.sendOnNextSession.channel])
  expect(r.executed).toEqual([['agents.openLauncher', { worktreeId: WT }]])
  expect(r.store.getState().launchSuggestion?.waiting).toBe(true)
  expect(COMMENTS_COMMANDS.openDrawer).toBe('comments.openDrawer')
})

test('cancelLaunch cancels the pending entry', async () => {
  r = mountRenderer()
  r.store.getState().applyResult(WT, ['c'], { status: 'noSession' })
  await createSendFlow(r, r.store).cancelLaunch(WT)
  expect(r.store.getState().launchSuggestion).toBeNull()
  expect(r.fakeIpc.callsOn(commentsIpc.cancelPending.channel)).toEqual([{ worktreeId: WT }])
})
