import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
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
const SENT_OK: SendResult = { status: 'sent', sessionId: 'a', round: 1, commentIds: [], replyIds: [], sentAt: 1 }

async function open(opts: { threads?: Comment[]; activeWorktreeId?: string | null } = {}) {
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
    await waitFor(() => expect(r.store.getState().threads).toHaveLength(opts.threads?.length ?? 0))
  return screen.getByTestId(T.drawer)
}
const rows = () => screen.queryAllByTestId(T.row)
const draftA = () => makeComment({ id: 'a1', filePath: 'src/a.ts', lineStart: 3, lineEnd: 5, body: 'First' })
const draftB = () =>
  makeComment({ id: 'b1', source: 'editor', filePath: 'b.md', lineStart: 1, lineEnd: 1, body: 'Two' })

describe('CommentsDrawer', () => {
  test('renders drafts with location label and source', async () => {
    await open({ threads: [draftA(), draftB()] })
    expect(rows()).toHaveLength(2)
    const first = within(rows()[0] as HTMLElement)
    expect(first.getByText('src/a.ts:3-5')).toBeInTheDocument()
    expect(first.getByRole('img', { name: en.row.source.diff })).toBeInTheDocument()
    expect(within(rows()[1] as HTMLElement).getByRole('img', { name: en.row.source.editor })).toBeInTheDocument()
  })

  test('the footer sends every pending item of the worktree; disabled with nothing pending', async () => {
    await open({ threads: [draftA(), draftB(), makeComment({ id: 'c1', round: 1 })] })
    const send = screen.getByTestId(T.sendButton)
    expect(send).toHaveTextContent('Send 2 pending items')
    fireEvent.click(send)
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ worktreeId: WT }]))
    r.data.threads = [makeComment({ id: 'c1', round: 1 })]
    await act(() => r.store.getState().reload())
    expect(screen.getByTestId(T.sendButton)).toBeDisabled()
    expect(screen.getByTestId(T.sendButton)).toHaveTextContent(en.drawer.nothingToSend)
  })

  test('Edit and Delete are labelled, always rendered buttons on every draft row', async () => {
    await open({ threads: [draftA(), draftB()] })
    for (const row of rows()) {
      const scope = within(row)
      expect(scope.getByRole('button', { name: en.row.edit })).toHaveAttribute('title', en.row.edit)
      expect(scope.getByRole('button', { name: en.row.delete })).toHaveAttribute('title', en.row.delete)
    }
  })

  test('delete calls comments.remove', async () => {
    await open({ threads: [draftA()] })
    fireEvent.click(screen.getByTestId(T.rowDelete))
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([{ id: 'a1' }]))
  })

  test('edit swaps in the edit-mode composer', async () => {
    await open({ threads: [draftA()] })
    fireEvent.click(screen.getByTestId(T.rowEdit))
    expect(screen.getByTestId(T.composerInput)).toHaveValue('First')
    expect(screen.getByTestId(T.composerSave)).toBeInTheDocument()
  })

  test('no threads → the empty text', async () => {
    await open()
    expect(rows()).toEqual([])
    expect(screen.getByText(en.drawer.emptyThreads)).toBeInTheDocument()
  })

  test('target picker preselects the default and sends to the chosen session', async () => {
    await open({ threads: [draftA()] })
    act(() => r.store.getState().applyResult(WT, { status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'b' }))
    const picker = await screen.findByTestId(T.targetPicker)
    const options = within(picker).getAllByRole('radio')
    expect(options[1]).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(options[0] as HTMLElement)
    fireEvent.click(within(picker).getByTestId(T.targetSend))
    await waitFor(() =>
      expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ worktreeId: WT, targetSessionId: 'a' }]),
    )
    await waitFor(() => expect(screen.queryByTestId(T.targetPicker)).toBeNull())
  })

  test('launch suggestion Start agent calls startAgentAndSend and shows waiting', async () => {
    await open({ threads: [draftA()] })
    act(() => r.store.getState().applyResult(WT, { status: 'noSession' }))
    fireEvent.click(await screen.findByTestId(T.launchStart))
    await waitFor(() => expect(r.executed).toEqual([['agents.openLauncher', { worktreeId: WT }]]))
    expect(r.fakeIpc.callsOn(commentsIpc.sendOnNextSession.channel)).toEqual([{ worktreeId: WT }])
    act(() => r.store.getState().openDrawer())
    expect(await screen.findByText(en.launch.waiting)).toBeInTheDocument()
    expect(screen.queryByTestId(T.launchSuggestion)).toBeNull()
  })

  test('lastError rendered via t()', async () => {
    await open({ threads: [draftA()] })
    act(() => r.store.getState().applyResult(WT, { status: 'failed', errorKey: 'sessionNotRunning' }))
    expect(screen.getByTestId(T.error)).toHaveTextContent(en.errors.sessionNotRunning)
  })

  test('noWorktree state', async () => {
    await open({ activeWorktreeId: null })
    expect(screen.getByText(en.drawer.noWorktree)).toBeInTheDocument()
  })
})
