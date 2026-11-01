import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, test } from 'vitest'
import { type Comment, commentsIpc, type SendResult, COMMENTS_TESTIDS as T } from '../../src/contract'
import { CommentsDrawer } from '../../src/renderer/components/CommentsDrawer'
import { LaunchSuggestionDialog } from '../../src/renderer/components/LaunchSuggestionDialog'
import { TargetPickerDialog } from '../../src/renderer/components/TargetPickerDialog'
import { makeComment, WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { en, renderUi } from './render'

let r: MountedRenderer
afterEach(() => r.stop())

const SESSIONS = [
  { id: 'a', title: 'Agent A', mode: 'terminal', status: 'idle' },
  { id: 'b', title: 'Agent B', mode: 'terminal', status: 'idle' },
]
const SENT_OK: SendResult = { status: 'sent', sessionId: 'a', commentIds: [], sentAt: 1 }

async function open(opts: { drafts?: Comment[]; sent?: Comment[]; activeWorktreeId?: string | null } = {}) {
  r = mountRenderer(opts)
  r.fakeIpc.respond(commentsIpc.send, () => SENT_OK)
  r.fakeIpc.respond(commentsIpc.resolveTarget, () => ({ kind: 'choose', sessions: SESSIONS, defaultSessionId: 'a' }))
  r.init()
  r.store.getState().openDrawer()
  renderUi(
    <>
      <CommentsDrawer />
      <TargetPickerDialog />
      <LaunchSuggestionDialog />
    </>,
  )
  if (opts.activeWorktreeId !== null)
    await waitFor(() => expect(r.store.getState().drafts).toHaveLength(opts.drafts?.length ?? 0))
  return screen.getByTestId(T.drawer)
}
const rows = () => screen.queryAllByTestId(T.row)
const draftA = () => makeComment({ id: 'a1', filePath: 'src/a.ts', lineStart: 3, lineEnd: 5, body: 'First' })
const draftB = () =>
  makeComment({ id: 'b1', source: 'editor', filePath: 'b.md', lineStart: 1, lineEnd: 1, body: 'Two' })

describe('CommentsDrawer', () => {
  test('renders drafts with location label and source', async () => {
    await open({ drafts: [draftA(), draftB()] })
    expect(rows()).toHaveLength(2)
    const first = within(rows()[0] as HTMLElement)
    expect(first.getByText('src/a.ts:3-5')).toBeInTheDocument()
    expect(first.getByRole('img', { name: en.row.source.diff })).toBeInTheDocument()
    expect(within(rows()[1] as HTMLElement).getByRole('img', { name: en.row.source.editor })).toBeInTheDocument()
  })

  it.each([
    ['no selection → all ids', [] as string[], ['a1', 'b1', 'c1'], 'Send all 3 comments'],
    ['two selected → those ids', ['a1', 'c1'], ['a1', 'c1'], 'Send 2 comments'],
  ])('selection controls the footer label and the sent ids: %s', async (_n, select, ids, label) => {
    await open({ drafts: [draftA(), draftB(), makeComment({ id: 'c1' })] })
    for (const id of select) {
      const row = rows().find((el) => el.dataset.commentId === id) as HTMLElement
      fireEvent.click(within(row).getByTestId(T.rowSelect))
    }
    const send = screen.getByTestId(T.sendButton)
    expect(send).toHaveTextContent(label)
    fireEvent.click(send)
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ commentIds: ids }]))
  })

  test('delete calls comments.remove', async () => {
    await open({ drafts: [draftA()] })
    fireEvent.click(screen.getByTestId(T.rowDelete))
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([{ id: 'a1' }]))
  })

  test('edit swaps in the edit-mode composer', async () => {
    await open({ drafts: [draftA()] })
    fireEvent.click(screen.getByTestId(T.rowEdit))
    expect(screen.getByTestId(T.composerInput)).toHaveValue('First')
    expect(screen.getByTestId(T.composerSave)).toBeInTheDocument()
  })

  test('sent tab lists newest first with the session title', async () => {
    const sent = [
      makeComment({ id: 'n', status: 'sent', sentAt: 20, targetSessionId: 'b', body: 'Newer' }),
      makeComment({ id: 'o', status: 'sent', sentAt: 10, targetSessionId: 'gone', body: 'Older' }),
    ]
    await open({ sent })
    act(() => r.store.getState().setTab('sent'))
    await waitFor(() => expect(screen.getByText(/Sent to Agent B/)).toBeInTheDocument())
    expect(rows().map((el) => el.dataset.commentId)).toEqual(['n', 'o'])
    expect(screen.getByText(/Sent to a closed session/)).toBeInTheDocument()
  })

  test('target picker preselects the default and sends to the chosen session', async () => {
    await open({ drafts: [draftA()] })
    act(() =>
      r.store.getState().applyResult(WT, ['a1'], { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'b' }),
    )
    const picker = await screen.findByTestId(T.targetPicker)
    const options = within(picker).getAllByRole('radio')
    expect(options[1]).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(options[0] as HTMLElement)
    fireEvent.click(within(picker).getByTestId(T.targetSend))
    await waitFor(() =>
      expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ commentIds: ['a1'], targetSessionId: 'a' }]),
    )
    await waitFor(() => expect(screen.queryByTestId(T.targetPicker)).toBeNull())
  })

  test('launch suggestion Start agent calls startAgentAndSend and shows waiting', async () => {
    await open({ drafts: [draftA()] })
    act(() => r.store.getState().applyResult(WT, ['a1'], { status: 'noSession' }))
    fireEvent.click(await screen.findByTestId(T.launchStart))
    await waitFor(() => expect(r.executed).toEqual([['agents.openLauncher', { worktreeId: WT }]]))
    expect(r.fakeIpc.callsOn(commentsIpc.sendOnNextSession.channel)).toEqual([{ worktreeId: WT, commentIds: ['a1'] }])
    act(() => r.store.getState().openDrawer())
    expect(await screen.findByText(en.launch.waiting)).toBeInTheDocument()
    expect(screen.queryByTestId(T.launchSuggestion)).toBeNull()
  })

  test('lastError rendered via t()', async () => {
    await open({ drafts: [draftA()] })
    act(() => r.store.getState().applyResult(WT, ['a1'], { status: 'failed', errorKey: 'sessionNotRunning' }))
    expect(screen.getByTestId(T.error)).toHaveTextContent(en.errors.sessionNotRunning)
  })

  test('noWorktree state', async () => {
    await open({ activeWorktreeId: null })
    expect(screen.getByText(en.drawer.noWorktree)).toBeInTheDocument()
  })
})
