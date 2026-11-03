import {
  COMMENTS_CHANNELS,
  COMPOSER_RESULT,
  type Comment,
  type CommentComposerProps,
  type ComposerResult,
  commentsIpc,
} from '@pragma/module-comments/contract'
import type { IpcContract } from '@pragma/sdk'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitChangesTestIds as T } from '../src/contract'
import { CommentCard } from '../src/renderer/comments/CommentCard'
import { useGitChangesStore, viewOf } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'

const COMPOSER_ID = 'recording-composer'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const draft: Comment = {
  id: 'c1',
  worktreeId: WT_ID,
  source: 'diff',
  filePath: 'src/app.ts',
  lineStart: 10,
  lineEnd: 12,
  diffSide: 'new',
  snippet: 'const a = 1',
  body: 'rename this',
  createdAt: 0,
  updatedAt: 0,
}

let lastProps: CommentComposerProps | undefined
function RecordingComposer(props: CommentComposerProps) {
  lastProps = props
  return <div data-testid={COMPOSER_ID} />
}

async function mountCard(remove: () => unknown = () => undefined) {
  lastProps = undefined
  const openDrawer = vi.fn()
  h = await mountPanel({
    render: <CommentCard comment={draft} />,
    ui: { CommentComposer: RecordingComposer, openDrawer },
    commentContracts: [commentsIpc.remove] as IpcContract<unknown, unknown>[],
    answers: { [COMMENTS_CHANNELS.remove]: remove },
  })
  return openDrawer
}

const finish = (r: ComposerResult) => act(() => lastProps?.onDone?.(r))

describe('CommentCard Edit', () => {
  it('reopens the inline composer in edit mode at the card, prefilled, instead of the drawer', async () => {
    const openDrawer = await mountCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(openDrawer).not.toHaveBeenCalled()
    expect(await screen.findByTestId(COMPOSER_ID)).toBeInTheDocument()
    expect(screen.queryByTestId(T.commentCard)).toBeNull()
    expect(lastProps).toMatchObject({
      worktreeId: WT_ID,
      editCommentId: 'c1',
      initialBody: 'rename this',
      context: { source: 'diff', filePath: 'src/app.ts', lineStart: 10, lineEnd: 12, diffSide: 'new' },
    })
  })

  it.each([
    ['saved', { kind: COMPOSER_RESULT.saved, comment: { ...draft, body: 'x' } }],
    ['cancelled', { kind: COMPOSER_RESULT.cancelled }],
  ] as const)('%s closes the edit box and shows the card again', async (_name, result) => {
    await mountCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await screen.findByTestId(COMPOSER_ID)
    await finish(result)
    expect(await screen.findByTestId(T.commentCard)).toBeInTheDocument()
    expect(screen.queryByTestId(COMPOSER_ID)).toBeNull()
  })

  it('editing one comment closes a new-comment composer and vice versa', async () => {
    await mountCard()
    const s = useGitChangesStore.getState()
    act(() => s.openComposer(WT_ID, { source: 'diff', filePath: 'src/app.ts', lineStart: 1 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    expect(viewOf(useGitChangesStore.getState(), WT_ID)).toMatchObject({ composer: null, editingId: 'c1' })
    act(() => s.openComposer(WT_ID, { source: 'diff', filePath: 'src/app.ts', lineStart: 1 }))
    expect(viewOf(useGitChangesStore.getState(), WT_ID).editingId).toBeNull()
  })
})

describe('CommentCard Delete', () => {
  const removes = () => h?.callsOn(COMMENTS_CHANNELS.remove)

  it('the trash button asks inline first; Delete removes only this comment through 05, never the drawer', async () => {
    const openDrawer = await mountCard()
    await userEvent.click(await screen.findByRole('button', { name: 'Delete comment' }))
    expect(removes()).toEqual([])
    expect(screen.getByTestId(T.commentCard)).toHaveTextContent('Delete this comment?')
    await userEvent.click(screen.getByTestId(T.commentDeleteConfirm))
    await waitFor(() => expect(removes()).toEqual([{ id: 'c1' }]))
    expect(openDrawer).not.toHaveBeenCalled()
  })

  it('Cancel leaves the comment alone and brings back Edit', async () => {
    await mountCard()
    await userEvent.click(await screen.findByTestId(T.commentDelete))
    await userEvent.click(screen.getByTestId(T.commentDeleteCancel))
    expect(removes()).toEqual([])
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
  })

  it('a failed delete shows an error on the card', async () => {
    await mountCard(() => {
      throw new Error('db locked')
    })
    await userEvent.click(await screen.findByTestId(T.commentDelete))
    await userEvent.click(screen.getByTestId(T.commentDeleteConfirm))
    expect(await screen.findByRole('alert')).toHaveTextContent('The comment could not be deleted')
  })
})
