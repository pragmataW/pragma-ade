import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { THREAD_NARROW_PX } from '../../src/constants'
import { commentsIpc, COMMENTS_TESTIDS as T } from '../../src/contract'
import { ThreadView } from '../../src/renderer/components/thread/ThreadView'
import { aThread } from '../../src/testing'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { en, renderUi } from './render'
import { fakeResizeObserver } from './resize'

let r: MountedRenderer
afterEach(() => r.stop())

const WIDE = THREAD_NARROW_PX + 100
const NARROW = THREAD_NARROW_PX - 60
const testIdsIn = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-testid]')].map((x) => x.getAttribute('data-testid'))

test('wide: Resolve, Edit and Delete inline in that order, exactly one delete, no overflow menu', () => {
  fakeResizeObserver(WIDE)
  r = mountRenderer()
  renderUi(<ThreadView comment={aThread({ id: 'a1' })} onEdit={() => undefined} />)
  const actions = screen.getByTestId(T.threadActions)
  expect(testIdsIn(actions)).toEqual([T.resolve, T.rowEdit, T.rowDelete])
  expect(screen.getAllByTestId(T.rowDelete)).toHaveLength(1)
  expect(screen.queryByTestId(T.threadMore)).toBeNull()
})

test('narrow: Resolve stays inline; Edit and Delete move into the … menu', async () => {
  fakeResizeObserver(NARROW)
  r = mountRenderer()
  renderUi(<ThreadView comment={aThread({ id: 'a2' })} onEdit={() => undefined} />)
  const actions = screen.getByTestId(T.threadActions)
  expect(testIdsIn(actions)).toEqual([T.resolve, T.threadMore])
  await userEvent.click(screen.getByTestId(T.threadMore))
  expect(await screen.findByTestId(T.rowEdit)).toHaveTextContent(en.row.edit)
  await userEvent.click(screen.getByTestId(T.rowDelete))
  expect(await screen.findByTestId(T.threadDeleteConfirm)).toBeInTheDocument()
})

test('Delete asks inline first; Cancel keeps the thread, Delete removes it', async () => {
  fakeResizeObserver(WIDE)
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.remove, () => undefined)
  renderUi(<ThreadView comment={aThread({ id: 'a3' })} />)
  fireEvent.click(screen.getByTestId(T.rowDelete))
  expect(screen.getByText(en.thread.confirmDelete)).toBeInTheDocument()
  fireEvent.click(screen.getByTestId(T.threadDeleteCancel))
  expect(screen.queryByTestId(T.threadDeleteConfirm)).toBeNull()
  expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([])
  fireEvent.click(screen.getByTestId(T.rowDelete))
  fireEvent.click(screen.getByTestId(T.threadDeleteConfirm))
  await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([{ id: 'a3' }]))
})

test('a failed delete shows an alert on the thread', async () => {
  fakeResizeObserver(WIDE)
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.remove, () => {
    throw new Error('gone')
  })
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  renderUi(<ThreadView comment={aThread({ id: 'a4' })} />)
  fireEvent.click(screen.getByTestId(T.rowDelete))
  fireEvent.click(screen.getByTestId(T.threadDeleteConfirm))
  expect(await screen.findByRole('alert')).toHaveTextContent(en.thread.deleteFailed)
})

test('the header shows the round chip of a delivered thread', () => {
  r = mountRenderer()
  renderUi(<ThreadView comment={aThread({ id: 'a5', round: 2 })} />)
  expect(screen.getByTestId(T.threadRound)).toHaveTextContent('R2')
  expect(screen.getByTestId(T.threadRound)).toHaveAttribute('title', 'Round 2')
})
