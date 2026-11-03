import { COMMENTS_CHANNELS, type Comment, type CommentsUiService, commentsIpc } from '@pragma/module-comments/contract'
import { aReply } from '@pragma/module-comments/testing'
import type { IpcContract } from '@pragma/sdk'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REVIEW_BAR_NARROW_PX } from '../src/constants'
import { GitChangesTestIds as T } from '../src/contract'
import { ReviewBar } from '../src/renderer/comments/ReviewBar'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const draft = (id: string): Comment => ({
  id,
  worktreeId: WT_ID,
  source: 'diff',
  filePath: 'src/app.ts',
  lineStart: 10,
  lineEnd: 12,
  diffSide: 'new',
  body: `comment ${id}`,
  status: 'open',
  replies: [],
  createdAt: 0,
  updatedAt: 0,
})
const DRAFTS = [draft('c1'), draft('c2')]
const delivered = (id: string, over: Partial<Comment> = {}): Comment => ({ ...draft(id), round: 1, ...over })
/** Two new diff threads, an editor draft, a user reply waiting on a delivered thread and a resolved one. */
const THREADS: Comment[] = [
  ...DRAFTS,
  { ...draft('e1'), source: 'editor', diffSide: undefined },
  delivered('d1', { replies: [aReply({ commentId: 'd1' })] }),
  delivered('r1', { status: 'resolved' }),
]

async function mountBar(
  send = vi.fn<CommentsUiService['send']>(async () => undefined),
  threads: readonly Comment[] = THREADS,
) {
  const clearResolved = vi.fn<CommentsUiService['clearResolved']>(async () => 1)
  h = await mountPanel({
    render: <ReviewBar worktreeId={WT_ID} threads={threads} fileName="app.ts" />,
    ui: { send, clearResolved },
    commentContracts: [commentsIpc.remove, commentsIpc.send] as IpcContract<unknown, unknown>[],
    answers: { [COMMENTS_CHANNELS.remove]: () => undefined },
    commentLocales: { errors: { deliveryFailed: 'The agent did not receive the comments' } },
  })
  return Object.assign(send, { clearResolved })
}

describe('ReviewBar', () => {
  it('counts every pending item of the worktree (editor drafts and user replies too)', async () => {
    await mountBar()
    expect(await screen.findByTestId(T.reviewBar)).toHaveTextContent('4 unsent items · app.ts')
    expect(screen.getByTestId(T.reviewSend)).toHaveTextContent('Send 4 to agent')
  })

  it('Discard needs a confirm, then removes only the new diff threads', async () => {
    await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewDiscard))
    expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([])
    expect(screen.getByTestId(T.reviewDiscard)).toHaveTextContent('Discard 2 new? Click again')
    await userEvent.click(screen.getByTestId(T.reviewDiscard))
    await waitFor(() => expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([{ id: 'c1' }, { id: 'c2' }]))
  })

  it("Send goes through 05's UI service with the worktree round, never the comments.send IPC", async () => {
    const send = await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewSend))
    await waitFor(() => expect(send).toHaveBeenCalledWith({ worktreeId: WT_ID }))
    expect(h?.callsOn(COMMENTS_CHANNELS.send)).toEqual([])
  })

  it('a failed result renders its error text', async () => {
    await mountBar(vi.fn<CommentsUiService['send']>(async () => ({ status: 'failed', errorKey: 'deliveryFailed' })))
    await userEvent.click(await screen.findByTestId(T.reviewSend))
    expect(await screen.findByRole('alert')).toHaveTextContent('The agent did not receive the comments')
  })

  it('Clear resolved goes through 05 and shows only with resolved threads', async () => {
    const { clearResolved } = await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewClearResolved))
    await waitFor(() => expect(clearResolved).toHaveBeenCalledWith(WT_ID))
  })

  it('only resolved threads: the bar stays for Clear resolved, Send and Discard are off', async () => {
    await mountBar(undefined, [delivered('r1', { status: 'resolved' })])
    expect(await screen.findByTestId(T.reviewClearResolved)).toBeInTheDocument()
    expect(screen.getByTestId(T.reviewSend)).toBeDisabled()
    expect(screen.queryByTestId(T.reviewDiscard)).toBeNull()
  })

  it('renders nothing without pending items or resolved threads', async () => {
    h = await mountPanel({ render: <ReviewBar worktreeId={WT_ID} threads={[delivered('o1')]} fileName="a" /> })
    expect(screen.queryByTestId(T.reviewBar)).toBeNull()
  })
})

describe('ReviewBar at a narrow width', () => {
  /** Every observed element reports this width (jsdom has no layout). */
  function reportWidth(width: number) {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(function (this: unknown, cb: ResizeObserverCallback) {
        return {
          observe: (target: Element) => cb([{ target, contentRect: { width } } as never], {} as ResizeObserver),
          unobserve: () => undefined,
          disconnect: () => undefined,
        }
      }),
    )
  }
  afterEach(() => vi.unstubAllGlobals())

  it('keeps only the count and Send inline; Discard and Clear resolved live in the … menu', async () => {
    reportWidth(REVIEW_BAR_NARROW_PX - 100)
    const { clearResolved } = await mountBar()
    await screen.findByTestId(T.reviewBar)
    expect(screen.queryByTestId(T.reviewDiscard)).toBeNull()
    expect(screen.queryByTestId(T.reviewClearResolved)).toBeNull()
    expect(screen.getByTestId(T.reviewSend)).toBeInTheDocument()
    await userEvent.click(screen.getByTestId(T.reviewMore))
    await userEvent.click(await screen.findByTestId(T.reviewClearResolved))
    await waitFor(() => expect(clearResolved).toHaveBeenCalledWith(WT_ID))
  })

  it('Discard from the menu asks inline in the bar; a second click discards', async () => {
    reportWidth(REVIEW_BAR_NARROW_PX - 100)
    await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewMore))
    await userEvent.click(await screen.findByTestId(T.reviewDiscard))
    expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([])
    const confirm = await screen.findByTestId(T.reviewDiscard)
    expect(confirm).toHaveTextContent('Discard 2 new? Click again')
    await userEvent.click(confirm)
    await waitFor(() => expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([{ id: 'c1' }, { id: 'c2' }]))
  })

  it('at a wide width everything stays inline', async () => {
    reportWidth(REVIEW_BAR_NARROW_PX + 100)
    await mountBar()
    expect(await screen.findByTestId(T.reviewDiscard)).toBeInTheDocument()
    expect(screen.getByTestId(T.reviewClearResolved)).toBeInTheDocument()
    expect(screen.queryByTestId(T.reviewMore)).toBeNull()
  })
})
