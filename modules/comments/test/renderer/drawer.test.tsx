import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, test } from 'vitest'
import { type Comment, commentsIpc, type SendResult, COMMENTS_TESTIDS as T } from '../../src/contract'
import { CommentsDrawer } from '../../src/renderer/components/CommentsDrawer'
import { LaunchSuggestionDialog } from '../../src/renderer/components/LaunchSuggestionDialog'
import { TargetPickerDialog } from '../../src/renderer/components/TargetPickerDialog'
import { aReply } from '../../src/testing'
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
  test('renders threads with location label and source', async () => {
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

  test('Edit shows only on a pending root; Resolve and Delete are labelled buttons on every row', async () => {
    await open({ threads: [draftA(), makeComment({ id: 'sent', round: 1 })] })
    const [pending, sent] = rows().map((row) => within(row))
    expect(pending?.getByRole('button', { name: en.row.edit })).toHaveAttribute('title', en.row.edit)
    expect(sent?.queryByRole('button', { name: en.row.edit })).toBeNull()
    for (const scope of [pending, sent]) {
      expect(scope?.getByRole('button', { name: en.thread.resolve })).toBeInTheDocument()
      expect(scope?.getByRole('button', { name: en.row.delete })).toHaveAttribute('title', en.row.delete)
    }
    expect(pending?.getByTestId(T.pendingBadge)).toHaveTextContent(en.thread.pending)
    expect(sent?.queryByTestId(T.pendingBadge)).toBeNull()
  })

  test('open threads first; resolved ones sit in a collapsed "Resolved (n)" section', async () => {
    await open({ threads: [makeComment({ id: 'r1', status: 'resolved', round: 1 }), draftA()] })
    expect(rows().map((el) => el.dataset.commentId)).toEqual(['a1'])
    const section = screen.getByTestId(T.resolvedSection)
    fireEvent.click(within(section).getByRole('button', { name: 'Resolved (1)' }))
    expect(rows().map((el) => el.dataset.commentId)).toEqual(['a1', 'r1'])
    expect(within(section).getByTestId(T.threadStatus)).toHaveTextContent(en.thread.resolved)
  })

  test('replies show author badges (You / agent label / Agent) and Pending on unsent user replies', async () => {
    const replies = [
      aReply({ commentId: 'a1', author: 'agent', authorLabel: 'Claude', round: 1, body: 'Done.' }),
      aReply({ commentId: 'a1', author: 'agent', round: 1, body: 'Also.' }),
      aReply({ commentId: 'a1', body: 'Not yet.' }),
    ]
    await open({ threads: [{ ...draftA(), round: 1, replies }] })
    const items = screen.getAllByTestId(T.reply)
    expect(items.map((el) => within(el).getByTestId(T.replyAuthor).textContent)).toEqual([
      'Claude',
      en.thread.agent,
      en.thread.you,
    ])
    expect(items.map((el) => within(el).queryByTestId(T.pendingBadge) !== null)).toEqual([false, false, true])
    fireEvent.click(within(items[2] as HTMLElement).getByTestId(T.replyDiscard))
    await waitFor(() =>
      expect(r.fakeIpc.callsOn(commentsIpc.removeReply.channel)).toEqual([{ replyId: replies[2]?.id }]),
    )
  })

  test('the reply box submits through comments.reply; Esc cancels', async () => {
    await open({ threads: [draftA()] })
    fireEvent.click(screen.getByTestId(T.replyOpen))
    fireEvent.keyDown(screen.getByTestId(T.replyInput), { key: 'Escape' })
    expect(screen.queryByTestId(T.replyInput)).toBeNull()
    fireEvent.click(screen.getByTestId(T.replyOpen))
    fireEvent.change(screen.getByTestId(T.replyInput), { target: { value: 'Please also rename b.' } })
    fireEvent.keyDown(screen.getByTestId(T.replyInput), { key: 'Enter', metaKey: true })
    await waitFor(() =>
      expect(r.fakeIpc.callsOn(commentsIpc.reply.channel)).toEqual([{ id: 'a1', body: 'Please also rename b.' }]),
    )
    await waitFor(() => expect(screen.queryByTestId(T.replyInput)).toBeNull())
  })

  it.each([
    ['open', T.resolve, 'resolved'],
    ['resolved', T.reopen, 'open'],
  ] as const)('a %s thread: the action sets the other status', async (status, testId, next) => {
    await open({ threads: [{ ...draftA(), status, round: 1 }] })
    if (status === 'resolved') fireEvent.click(screen.getByRole('button', { name: 'Resolved (1)' }))
    fireEvent.click(screen.getByTestId(testId))
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.setStatus.channel)).toEqual([{ id: 'a1', status: next }]))
  })

  it.each([
    [true, [{ worktreeId: WT }]],
    [false, []],
  ])('Clear resolved asks first (confirmed: %s)', async (answer, cleared) => {
    await open({ threads: [draftA(), makeComment({ id: 'r1', status: 'resolved', round: 1 })] })
    r.confirmAnswer.value = answer
    r.fakeIpc.respond(commentsIpc.clearResolved, () => ({ count: 1 }))
    fireEvent.click(screen.getByTestId(T.clearResolved))
    await waitFor(() => expect(r.confirms).toHaveLength(1))
    expect(r.confirms[0]).toMatchObject({
      destructive: true,
      titleKey: 'comments:clearResolved.title',
      params: { count: 1 },
    })
    await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.clearResolved.channel)).toEqual(cleared))
  })

  test('no resolved threads → no Clear resolved', async () => {
    await open({ threads: [draftA()] })
    expect(screen.queryByTestId(T.clearResolved)).toBeNull()
  })

  test('delete asks inline, then calls comments.remove', async () => {
    await open({ threads: [draftA()] })
    fireEvent.click(screen.getByTestId(T.rowDelete))
    expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([])
    fireEvent.click(screen.getByTestId(T.threadDeleteConfirm))
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
