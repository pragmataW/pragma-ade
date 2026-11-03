import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { commentsIpc, commentsIpcEvents, type SendResult } from '../../src/contract'
import { selectPending } from '../../src/renderer/store'
import { aReply } from '../../src/testing'
import { makeComment, OTHER_WT, WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'

let r: MountedRenderer | undefined
const mount = (...a: Parameters<typeof mountRenderer>) => {
  r = mountRenderer(...a)
  return r
}
afterEach(() => r?.stop())
const state = () => (r as MountedRenderer).store.getState()
const flush = () => new Promise((res) => setTimeout(res, 0))

describe('store', () => {
  test('init loads drafts for the active worktree', async () => {
    const c = makeComment()
    mount({ threads: [c] }).init()
    await vi.waitFor(() => expect(state().threads).toEqual([c]))
    expect(state().activeWorktreeId).toBe(WT)
  })

  test('comments.changed reloads only for the active worktree', async () => {
    const m = mount()
    m.init()
    await flush()
    const before = m.fakeIpc.callsOn(commentsIpc.list.channel).length
    m.fakeIpc.emit(commentsIpcEvents.changed, { worktreeId: OTHER_WT })
    m.fakeIpc.emit(commentsIpcEvents.changed, { worktreeId: WT })
    await flush()
    expect(m.fakeIpc.callsOn(commentsIpc.list.channel).length).toBe(before + 1)
  })

  test('active worktree change clears the threads and reloads', async () => {
    const m = mount({ threads: [makeComment({ id: 'a' })], round: 2 })
    m.init()
    await vi.waitFor(() => expect(state().threads).toHaveLength(1))
    expect(state().round).toBe(2)
    m.data.threads = []
    m.projects.setActive(OTHER_WT)
    expect(state().threads).toEqual([])
    await flush()
    expect(state().activeWorktreeId).toBe(OTHER_WT)
    expect(m.fakeIpc.callsOn(commentsIpc.list.channel).at(-1)).toEqual({ worktreeId: OTHER_WT })
  })

  test('selectPending counts pending roots and pending user replies', () => {
    mount()
    r?.store.setState({
      threads: [
        makeComment({ round: 1, replies: [aReply({ round: 1 }), aReply(), aReply({ author: 'agent', round: 1 })] }),
        makeComment(),
      ],
    })
    expect(selectPending(state())).toBe(2)
  })

  const SESSIONS = [{ id: 'a', title: 'A', mode: 'terminal', status: 'idle' }]
  it.each<[string, SendResult, (s: ReturnType<typeof state>) => unknown, unknown]>([
    [
      'sent',
      { status: 'sent', sessionId: 'a', round: 1, commentIds: ['c'], replyIds: [], sentAt: 1 },
      (s) => s.lastError,
      null,
    ],
    [
      'needsTarget',
      { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' },
      (s) => s.targetPicker,
      { worktreeId: WT, sessions: SESSIONS, defaultSessionId: 'a' },
    ],
    ['noSession', { status: 'noSession' }, (s) => s.launchSuggestion, { worktreeId: WT, count: 1, waiting: false }],
    ['failed', { status: 'failed', errorKey: 'agentNotReady' }, (s) => s.lastError, 'agentNotReady'],
  ])('applyResult %s', (_n, result, pick, want) => {
    mount()
    r?.store.setState({ activeWorktreeId: WT, threads: [makeComment()] })
    state().applyResult(WT, result)
    expect(pick(state())).toEqual(want)
  })

  test('sendRequested opens the drawer + dialog', () => {
    const m = mount()
    m.init()
    m.fakeIpc.emit(commentsIpcEvents.sendRequested, {
      worktreeId: WT,
      result: { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' },
    })
    expect(state().drawer.open).toBe(true)
    expect(state().targetPicker?.worktreeId).toEqual(WT)
  })

  test('pendingDelivered clears the launch suggestion', () => {
    const m = mount()
    m.init()
    state().applyResult(WT, { status: 'noSession' })
    m.fakeIpc.emit(commentsIpcEvents.pendingDelivered, {
      worktreeId: WT,
      result: { status: 'sent', sessionId: 'a', round: 1, commentIds: ['c'], replyIds: [], sentAt: 1 },
    })
    expect(state().launchSuggestion).toBeNull()
  })
})
