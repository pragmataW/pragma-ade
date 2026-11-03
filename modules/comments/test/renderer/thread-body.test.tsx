import { fireEvent, screen } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { BODY_COLLAPSE_LINES } from '../../src/constants'
import { COMMENTS_TESTIDS as T } from '../../src/contract'
import { ThreadView } from '../../src/renderer/components/thread/ThreadView'
import { aReply, aThread } from '../../src/testing'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { en, renderUi } from './render'

let r: MountedRenderer
afterEach(() => r.stop())

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
