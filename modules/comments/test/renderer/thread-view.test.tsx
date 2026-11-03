import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { commentsIpc, COMMENTS_TESTIDS as T } from '../../src/contract'
import { ThreadView } from '../../src/renderer/components/thread/ThreadView'
import { aReply, aThread } from '../../src/testing'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { en, renderUi } from './render'

let r: MountedRenderer
afterEach(() => r.stop())

const resolved = () =>
  aThread({ id: 't1', status: 'resolved', round: 1, replies: [aReply({ author: 'agent', round: 1, body: 'Fixed.' })] })

test('a resolved thread starts collapsed; the toggle shows its replies and the reply box', () => {
  r = mountRenderer()
  renderUi(<ThreadView comment={resolved()} locationLabel="L1–2" />)
  expect(screen.getByTestId(T.threadStatus)).toHaveTextContent(en.thread.resolved)
  expect(screen.queryByTestId(T.reply)).toBeNull()
  expect(screen.queryByTestId(T.replyOpen)).toBeNull()
  const toggle = screen.getByTestId(T.threadToggle)
  expect(toggle).toHaveTextContent('Show thread (1 reply)')
  fireEvent.click(toggle)
  expect(screen.getByTestId(T.reply)).toHaveTextContent('Fixed.')
  expect(screen.getByTestId(T.replyOpen)).toBeInTheDocument()
  expect(toggle).toHaveTextContent(en.thread.collapse)
})

test('an open thread is expanded, has no toggle and shows its location; Edit needs the host callback', () => {
  r = mountRenderer()
  renderUi(<ThreadView comment={aThread({ id: 't2' })} locationLabel="L1–2" />)
  expect(screen.getByText('L1–2')).toBeInTheDocument()
  expect(screen.queryByTestId(T.threadToggle)).toBeNull()
  expect(screen.queryByTestId(T.rowEdit)).toBeNull()
  expect(screen.getByTestId(T.threadStatus)).toHaveTextContent(en.thread.open)
})

test("Delete runs the host's delete flow instead of deleting at once", () => {
  r = mountRenderer()
  const onDelete = vi.fn()
  renderUi(<ThreadView comment={aThread({ id: 't3' })} onDelete={onDelete} />)
  fireEvent.click(screen.getByTestId(T.rowDelete))
  expect(onDelete).toHaveBeenCalledOnce()
  expect(r.fakeIpc.callsOn(commentsIpc.remove.channel)).toEqual([])
})
