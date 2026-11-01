import { COMMENTS_CHANNELS, type Comment, type CommentsUiService, commentsIpc } from '@pragma/module-comments/contract'
import type { IpcContract } from '@pragma/sdk'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
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
  createdAt: 0,
  updatedAt: 0,
})
const DRAFTS = [draft('c1'), draft('c2')]

async function mountBar(send = vi.fn<CommentsUiService['send']>(async () => undefined)) {
  h = await mountPanel({
    render: <ReviewBar comments={DRAFTS} fileName="app.ts" />,
    ui: { send },
    commentContracts: [commentsIpc.remove, commentsIpc.send] as IpcContract<unknown, unknown>[],
    answers: { [COMMENTS_CHANNELS.remove]: () => undefined },
    commentLocales: { errors: { deliveryFailed: 'The agent did not receive the comments' } },
  })
  return send
}

describe('ReviewBar', () => {
  it('2 drafts render "2 pending comments" with the file name', async () => {
    await mountBar()
    expect(await screen.findByTestId(T.reviewBar)).toHaveTextContent('2 pending comments · app.ts')
    expect(screen.getByTestId(T.reviewSend)).toHaveTextContent('Send 2 comments to agent')
  })

  it('Discard needs a confirm, then removes both drafts', async () => {
    await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewDiscard))
    expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([])
    expect(screen.getByTestId(T.reviewDiscard)).toHaveTextContent('Discard 2? Click again')
    await userEvent.click(screen.getByTestId(T.reviewDiscard))
    await waitFor(() => expect(h?.callsOn(COMMENTS_CHANNELS.remove)).toEqual([{ id: 'c1' }, { id: 'c2' }]))
  })

  it("Send goes through 05's UI service with both ids, never the comments.send IPC", async () => {
    const send = await mountBar()
    await userEvent.click(await screen.findByTestId(T.reviewSend))
    await waitFor(() => expect(send).toHaveBeenCalledWith(['c1', 'c2']))
    expect(h?.callsOn(COMMENTS_CHANNELS.send)).toEqual([])
  })

  it('a failed result renders its error text', async () => {
    await mountBar(vi.fn<CommentsUiService['send']>(async () => ({ status: 'failed', errorKey: 'deliveryFailed' })))
    await userEvent.click(await screen.findByTestId(T.reviewSend))
    expect(await screen.findByRole('alert')).toHaveTextContent('The agent did not receive the comments')
  })

  it('renders nothing without drafts', async () => {
    h = await mountPanel({ render: <ReviewBar comments={[]} fileName="a" /> })
    expect(screen.queryByTestId(T.reviewBar)).toBeNull()
  })
})
