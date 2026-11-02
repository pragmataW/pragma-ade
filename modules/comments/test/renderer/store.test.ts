import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { commentsIpc, commentsIpcEvents, type SendResult } from '../../src/contract'
import { locationLabel } from '../../src/renderer/location'
import { makeComment, makeElement, OTHER_WT, WT } from '../factories'
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
    mount({ drafts: [c] }).init()
    await vi.waitFor(() => expect(state().drafts).toEqual([c]))
    expect(state().activeWorktreeId).toBe(WT)
  })

  test('comments.changed reloads only for the active worktree', async () => {
    const m = mount()
    m.init()
    await flush()
    const before = m.fakeIpc.callsOn(commentsIpc.listDrafts.channel).length
    m.fakeIpc.emit(commentsIpcEvents.changed, { worktreeId: OTHER_WT })
    m.fakeIpc.emit(commentsIpcEvents.changed, { worktreeId: WT })
    await flush()
    expect(m.fakeIpc.callsOn(commentsIpc.listDrafts.channel).length).toBe(before + 1)
  })

  test('active worktree change clears selection and reloads', async () => {
    const m = mount({ drafts: [makeComment({ id: 'a' })] })
    m.init()
    await vi.waitFor(() => expect(state().drafts).toHaveLength(1))
    state().toggleSelected('a')
    m.data.drafts = []
    m.projects.setActive(OTHER_WT)
    expect(state().selection.size).toBe(0)
    await flush()
    expect(state().activeWorktreeId).toBe(OTHER_WT)
    expect(m.fakeIpc.callsOn(commentsIpc.listDrafts.channel).at(-1)).toEqual({ worktreeId: OTHER_WT })
  })

  test('loaded drafts start selected; an unticked one stays unticked across reloads', async () => {
    const m = mount({ drafts: [makeComment({ id: 'a' }), makeComment({ id: 'b' })] })
    m.init()
    await vi.waitFor(() => expect([...state().selection]).toEqual(['a', 'b']))
    state().toggleSelected('a')
    m.data.drafts = [makeComment({ id: 'a' }), makeComment({ id: 'c' })]
    await state().reload()
    expect([...state().selection]).toEqual(['c'])
    state().selectAll()
    expect([...state().selection]).toEqual(['a', 'c'])
    state().clearSelection()
    await state().reload()
    expect(state().selection.size).toBe(0)
  })

  test('a sent result unticks only the sent ids', () => {
    mount()
    for (const id of ['a', 'b']) state().toggleSelected(id)
    state().applyResult(WT, ['a'], { status: 'sent', sessionId: 's', commentIds: ['a'], sentAt: 1 })
    expect([...state().selection]).toEqual(['b'])
  })

  const SESSIONS = [{ id: 'a', title: 'A', mode: 'terminal', status: 'idle' }]
  it.each<[string, SendResult, (s: ReturnType<typeof state>) => unknown, unknown]>([
    ['sent', { status: 'sent', sessionId: 'a', commentIds: ['c'], sentAt: 1 }, (s) => s.selection.size, 0],
    [
      'needsTarget',
      { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' },
      (s) => s.targetPicker,
      { commentIds: ['c'], sessions: SESSIONS, defaultSessionId: 'a' },
    ],
    [
      'noSession',
      { status: 'noSession' },
      (s) => s.launchSuggestion,
      { worktreeId: WT, commentIds: ['c'], waiting: false },
    ],
    ['failed', { status: 'failed', errorKey: 'agentNotReady' }, (s) => s.lastError, 'agentNotReady'],
  ])('applyResult %s', (_n, result, pick, want) => {
    mount()
    state().toggleSelected('c')
    state().applyResult(WT, ['c'], result)
    expect(pick(state())).toEqual(want)
  })

  test('sendRequested opens the drawer + dialog', () => {
    const m = mount()
    m.init()
    m.fakeIpc.emit(commentsIpcEvents.sendRequested, {
      worktreeId: WT,
      commentIds: ['c'],
      result: { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' },
    })
    expect(state().drawer.open).toBe(true)
    expect(state().targetPicker?.commentIds).toEqual(['c'])
  })

  test('pendingDelivered clears the launch suggestion', () => {
    const m = mount()
    m.init()
    state().applyResult(WT, ['c'], { status: 'noSession' })
    m.fakeIpc.emit(commentsIpcEvents.pendingDelivered, {
      worktreeId: WT,
      result: { status: 'sent', sessionId: 'a', commentIds: ['c'], sentAt: 1 },
    })
    expect(state().launchSuggestion).toBeNull()
  })
})

it.each([
  ['range', makeComment({ filePath: 'a.ts', lineStart: 1, lineEnd: 3 }), 'a.ts:1-3'],
  ['one line', makeComment({ filePath: 'a.ts', lineStart: 4, lineEnd: 4 }), 'a.ts:4'],
  ['no lines', makeComment({ filePath: 'a.ts', lineStart: undefined, lineEnd: undefined }), 'a.ts'],
  ['browser', makeComment({ source: 'browser', element: makeElement({ selector: 'nav > a' }) }), 'nav > a'],
])('locationLabel %s', (_n, c, want) => expect(locationLabel(c)).toBe(want))
