import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, test, vi } from 'vitest'
import { type CommentContext, type ComposerResult, commentsIpc, COMMENTS_TESTIDS as T } from '../../src/contract'
import { CommentComposer } from '../../src/renderer/components/CommentComposer'
import { makeComment, WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { en, renderUi } from './render'

const CONTEXT: CommentContext = { source: 'diff', filePath: 'src/a.ts', lineStart: 3, lineEnd: 4, diffSide: 'new' }
let r: MountedRenderer
afterEach(() => r.stop())

function setup(props: Partial<Parameters<typeof CommentComposer>[0]> = {}) {
  r = mountRenderer()
  const draft = makeComment({ id: 'new' })
  r.fakeIpc.respond(commentsIpc.addDraft, () => draft)
  r.fakeIpc.respond(commentsIpc.update, () => ({ ...draft, body: 'edited' }))
  r.fakeIpc.respond(commentsIpc.send, () => ({
    status: 'sent',
    sessionId: 's',
    round: 1,
    commentIds: ['new'],
    replyIds: [],
    sentAt: 1,
  }))
  const onDone = vi.fn<(res: ComposerResult) => void>()
  renderUi(<CommentComposer worktreeId={WT} context={CONTEXT} onDone={onDone} {...props} />)
  const input = screen.getByTestId(T.composerInput)
  const type = (text: string) => fireEvent.change(input, { target: { value: text } })
  return { onDone, input, type, draft }
}
const kinds = (fn: ReturnType<typeof setup>['onDone']) => fn.mock.calls.map(([res]) => res.kind)

describe('CommentComposer', () => {
  test('Add to drafts sends worktreeId + context + trimmed body, then onDone drafted', async () => {
    const { onDone, type } = setup()
    type('  Fix this  ')
    fireEvent.click(screen.getByTestId(T.composerAddDraft))
    await waitFor(() => expect(kinds(onDone)).toEqual(['drafted']))
    const [input] = r.fakeIpc.callsOn(commentsIpc.addDraft.channel)
    expect(input).toMatchObject({ ...CONTEXT, worktreeId: WT })
    expect(commentsIpc.addDraft.input.parse(input).body).toBe('Fix this')
  })

  test('buttons disabled for whitespace-only body', () => {
    const { type } = setup()
    type('   \n ')
    for (const id of [T.composerAddDraft, T.composerSendNow]) expect(screen.getByTestId(id)).toBeDisabled()
  })

  it.each([
    ['Cmd+Enter → addDraft', { key: 'Enter', metaKey: true }, 'drafted', commentsIpc.addDraft.channel],
    ['Ctrl+Shift+Enter → send', { key: 'Enter', ctrlKey: true, shiftKey: true }, 'sent', commentsIpc.send.channel],
    ['Escape → cancelled', { key: 'Escape' }, 'cancelled', undefined],
  ])('keyboard: %s', async (_n, keys, kind, channel) => {
    const { onDone, input, type } = setup()
    type('note')
    fireEvent.keyDown(input, keys)
    await waitFor(() => expect(kinds(onDone)).toEqual([kind]))
    if (channel) expect(r.fakeIpc.callsOn(channel)).toHaveLength(1)
  })

  it.each([
    ['add mode', {}],
    ['edit mode', { editCommentId: 'c9', initialBody: 'old' }],
  ])('%s: Cancel button and Esc (from any control) report cancelled', async (_n, props) => {
    const { onDone } = setup(props)
    const cancel = screen.getByTestId(T.composerCancel)
    expect(cancel).toHaveTextContent(en.composer.cancel)
    fireEvent.click(cancel)
    fireEvent.keyDown(cancel, { key: 'Escape' })
    await waitFor(() => expect(kinds(onDone)).toEqual(['cancelled', 'cancelled']))
    expect(r.fakeIpc.callsOn(commentsIpc.addDraft.channel)).toHaveLength(0)
  })

  it.each([
    ['card (default)', {}, true],
    ['plain', { surface: 'plain' as const }, false],
  ])('surface %s', (_n, props, card) => {
    setup(props)
    expect(screen.getByTestId(T.composer).classList.contains('bg-card')).toBe(card)
  })

  test('Send now with several agents → picker opens, onDone drafted', async () => {
    const { onDone, type } = setup()
    r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'needsTarget', sessions: [], defaultSessionId: 'a' }))
    type('note')
    fireEvent.click(screen.getByTestId(T.composerSendNow))
    await waitFor(() => expect(kinds(onDone)).toEqual(['drafted']))
    expect(r.store.getState().targetPicker?.worktreeId).toEqual(WT)
    expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toEqual([{ worktreeId: WT }])
  })

  test('edit mode calls comments.update and onDone saved', async () => {
    const { onDone } = setup({ editCommentId: 'c9', initialBody: 'old' })
    expect(screen.queryByTestId(T.composerAddDraft)).toBeNull()
    fireEvent.change(screen.getByTestId(T.composerInput), { target: { value: 'edited' } })
    fireEvent.click(screen.getByTestId(T.composerSave))
    await waitFor(() => expect(kinds(onDone)).toEqual(['saved']))
    expect(r.fakeIpc.callsOn(commentsIpc.update.channel)).toEqual([{ id: 'c9', patch: { body: 'edited' } }])
  })

  test('showSendNow=false hides Send now', () => {
    setup({ showSendNow: false })
    expect(screen.queryByTestId(T.composerSendNow)).toBeNull()
  })

  test('labels come from the locale', () => {
    setup()
    expect(screen.getByTestId(T.composerAddDraft)).toHaveTextContent(en.composer.addDraft)
    expect(screen.getByTestId(T.composerSendNow)).toHaveTextContent(en.composer.sendNow)
    expect(screen.getByPlaceholderText(en.composer.placeholder)).toBeInTheDocument()
  })
})
