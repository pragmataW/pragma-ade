import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { BODY_COLLAPSE_LINES } from '../../src/constants'
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

const MINUTE = 60_000

test('the root shows You and a relative time; replies sit in a thread list with author, time and Pending', () => {
  r = mountRenderer()
  const now = Date.now()
  const thread = aThread({
    id: 't4',
    round: 1,
    createdAt: now - 5 * MINUTE,
    replies: [
      aReply({ author: 'agent', authorLabel: 'Claude Code', round: 1, body: 'Done.', createdAt: now - 2 * MINUTE }),
      aReply({ author: 'agent', round: 1, body: 'Also this.', createdAt: now }),
      aReply({ author: 'user', body: 'Thanks', createdAt: now }),
    ],
  })
  renderUi(<ThreadView comment={thread} />)
  expect(screen.getByTestId(T.threadAuthor)).toHaveTextContent(en.thread.you)
  const times = screen.getAllByTestId(T.threadTime)
  expect(times[0]).toHaveTextContent('5m ago')
  expect(times[0]).toHaveAttribute('dateTime', new Date(now - 5 * MINUTE).toISOString())
  const list = screen.getByTestId(T.threadReplies)
  const replies = within(list).getAllByTestId(T.reply)
  expect(replies.map((x) => within(x).getByTestId(T.replyAuthor).textContent)).toEqual([
    'Claude Code',
    en.thread.agent,
    en.thread.you,
  ])
  expect(within(replies[0] as HTMLElement).getByTestId(T.threadTime)).toHaveTextContent('2m ago')
  expect(within(replies[1] as HTMLElement).getByTestId(T.threadTime)).toHaveTextContent(en.time.justNow)
  expect(within(replies[0] as HTMLElement).queryByTestId(T.pendingBadge)).toBeNull()
  expect(within(replies[2] as HTMLElement).getByTestId(T.pendingBadge)).toBeInTheDocument()
})

test('no reply box until Reply is clicked; Esc and Cancel close it; a sent reply closes it', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.reply, () => aReply())
  renderUi(<ThreadView comment={aThread({ id: 't5' })} />)
  expect(screen.queryByRole('textbox')).toBeNull()
  fireEvent.click(screen.getByTestId(T.replyOpen))
  expect(screen.getByTestId(T.replyInput)).toHaveFocus()
  fireEvent.keyDown(screen.getByTestId(T.replyInput), { key: 'Escape' })
  expect(screen.queryByTestId(T.replyInput)).toBeNull()
  fireEvent.click(screen.getByTestId(T.replyOpen))
  fireEvent.click(screen.getByTestId(T.replyCancel))
  expect(screen.queryByTestId(T.replyInput)).toBeNull()
  fireEvent.click(screen.getByTestId(T.replyOpen))
  fireEvent.change(screen.getByTestId(T.replyInput), { target: { value: 'On it' } })
  fireEvent.click(screen.getByTestId(T.replySubmit))
  await waitFor(() => expect(screen.queryByTestId(T.replyInput)).toBeNull())
  expect(r.fakeIpc.callsOn(commentsIpc.reply.channel)).toEqual([{ id: 't5', body: 'On it' }])
})

test('Reply and send stores the reply, then sends the worktree round; buttons read Cancel · Reply and send · Reply', async () => {
  r = mountRenderer()
  r.fakeIpc.respond(commentsIpc.reply, () => aReply())
  r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'sent', sessionId: 's1', count: 1 }))
  const thread = aThread({ id: 't6' })
  renderUi(<ThreadView comment={thread} />)
  fireEvent.click(screen.getByTestId(T.replyOpen))
  const buttons = [T.replyCancel, T.replySubmitAndSend, T.replySubmit].map((id) => screen.getByTestId(id))
  expect(buttons.map((b) => b.textContent)).toEqual([
    en.thread.replyCancel,
    en.thread.replyAndSend,
    en.thread.replySubmit,
  ])
  fireEvent.change(screen.getByTestId(T.replyInput), { target: { value: 'Go' } })
  fireEvent.click(screen.getByTestId(T.replySubmitAndSend))
  await waitFor(() => expect(r.fakeIpc.callsOn(commentsIpc.send.channel)).toHaveLength(1))
  expect(r.fakeIpc.callsOn(commentsIpc.reply.channel)).toEqual([{ id: 't6', body: 'Go' }])
  expect(r.fakeIpc.callsOn(commentsIpc.send.channel)[0]).toMatchObject({ worktreeId: thread.worktreeId })
})

const MARKDOWN = [
  'Done: **renamed** it.',
  '',
  '- first',
  '- second',
  '',
  'Use `appName`.',
  '',
  '```ts',
  'const appName = 1',
  '```',
].join('\n')

test('root and agent reply bodies render as markdown; raw HTML stays text', () => {
  r = mountRenderer()
  const thread = aThread({
    id: 'm1',
    round: 1,
    body: 'Root with **bold** <b>raw</b>',
    replies: [aReply({ author: 'agent', authorLabel: 'Claude Code', round: 1, body: MARKDOWN })],
  })
  const { container } = renderUi(<ThreadView comment={thread} />)
  const reply = screen.getByTestId(T.reply)
  expect(reply.querySelector('strong')).toHaveTextContent('renamed')
  expect(reply.querySelectorAll('li')).toHaveLength(2)
  expect(reply.querySelector(':not(pre) > code')).toHaveTextContent('appName')
  expect(reply.querySelector('pre, .pragma-code')).toHaveTextContent('const appName = 1')
  const root = screen.getAllByTestId(T.threadBody)[0] as HTMLElement
  expect(root.querySelector('strong')).toHaveTextContent('bold')
  expect(container.querySelector('b')).toBeNull()
})

test('a long reply starts clamped; Show more expands it and Show less clamps it again', () => {
  r = mountRenderer()
  const long = Array.from({ length: BODY_COLLAPSE_LINES + 4 }, (_, i) => `line ${i + 1}`).join('\n\n')
  renderUi(<ThreadView comment={aThread({ id: 'm2', replies: [aReply({ author: 'agent', round: 1, body: long })] })} />)
  const toggle = screen.getByTestId(T.threadBodyToggle)
  const body = toggle.parentElement?.querySelector(`[data-testid="${T.threadBody}"]`) as HTMLElement
  expect(body).toHaveAttribute('data-clamped', 'true')
  expect(toggle).toHaveTextContent(en.thread.showMore)
  fireEvent.click(toggle)
  expect(body).toHaveAttribute('data-clamped', 'false')
  expect(toggle).toHaveTextContent(en.thread.showLess)
})

test('a short body has no Show more', () => {
  r = mountRenderer()
  renderUi(<ThreadView comment={aThread({ id: 'm3' })} />)
  expect(screen.queryByTestId(T.threadBodyToggle)).toBeNull()
})
