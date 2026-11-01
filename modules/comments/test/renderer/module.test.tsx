import type { AgentSessionToolbarProps } from '@pragma/module-agents/contract'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, test } from 'vitest'
import {
  type CommentsUiService,
  CommentsUiServiceToken,
  commentsIpc,
  openDrawerCommand,
  COMMENTS_TESTIDS as T,
} from '../../src/contract'
import renderer from '../../src/renderer/index'
import { makeComment, makeSession, WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { renderUi } from './render'

let r: MountedRenderer
afterEach(() => r.stop())

const SESSIONS = [
  { id: 'a', title: 'A', mode: 'terminal', status: 'idle' },
  { id: 'b', title: 'B', mode: 'terminal', status: 'idle' },
]

function activate(opts: Parameters<typeof mountRenderer>[0] = {}) {
  r = mountRenderer(opts)
  renderer.activate(r)
  return r
}
const ui = () => r.provided.get(CommentsUiServiceToken.id) as CommentsUiService
const slot = (id: string) => r.slotEntries.find(([slotId]) => slotId === id)?.[1]

describe('renderer module', () => {
  test('activate registers the host and the toolbar badge, the command, the settings page (order 70) and the UI service', () => {
    activate()
    expect(r.slotEntries.map(([id, e]) => [id, e.id])).toEqual([
      ['titlebar.right', 'comments.host'],
      ['agentSession.toolbar', 'comments.badge'],
    ])
    expect(r.commands.has(openDrawerCommand.id)).toBe(true)
    expect(r.pagesRegistered.map((p) => [p.id, p.order])).toEqual([['comments', 70]])
    expect(ui().CommentComposer).toBeTypeOf('function')
  })

  test('ui.send with two running sessions opens the target picker; with one it sends directly', async () => {
    activate()
    r.fakeIpc.respond(commentsIpc.send, () => ({ status: 'needsTarget', sessions: SESSIONS, defaultSessionId: 'a' }))
    expect(await ui().send(['c1'])).toBeUndefined()
    expect(r.store.getState().targetPicker?.commentIds).toEqual(['c1'])
    const sent = { status: 'sent', sessionId: 'a', commentIds: ['c2'], sentAt: 1 }
    r.fakeIpc.respond(commentsIpc.send, () => sent)
    expect(await ui().send(['c2'])).toEqual(sent)
  })

  test('the openDrawer command opens the drawer', async () => {
    activate()
    await r.commands.execute(openDrawerCommand.id, { worktreeId: WT })
    expect(r.store.getState().drawer).toMatchObject({ open: true })
  })

  test('the titlebar host renders no button, only the (closed) drawer and dialogs', () => {
    activate()
    const Host = slot('titlebar.right')?.component as unknown as ComponentType
    const { container } = renderUi(<Host />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryAllByRole('button')).toEqual([])
  })

  test('ToolbarBadge click passes worktreeId + preferredSessionId', () => {
    activate()
    const Badge = slot('agentSession.toolbar')?.component as unknown as ComponentType<AgentSessionToolbarProps>
    renderUi(<Badge session={makeSession({ id: 's9' })} />)
    fireEvent.click(screen.getByTestId(T.toolbarBadge))
    expect(r.store.getState().drawer).toMatchObject({ open: true, preferredSessionId: 's9' })
  })

  it.each([0, 2])('badge count shown only when > 0 (%i)', async (n) => {
    activate({ drafts: Array.from({ length: n }, () => makeComment()) })
    await waitFor(() => expect(r.store.getState().drafts).toHaveLength(n))
    const Badge = slot('agentSession.toolbar')?.component as unknown as ComponentType<AgentSessionToolbarProps>
    renderUi(<Badge session={makeSession()} />)
    const button = screen.getByTestId(T.toolbarBadge)
    if (n) expect(button).toHaveTextContent(String(n))
    else expect(button).toHaveTextContent('')
  })

  test('settings switch calls ctx.settings.update {submitAfterPaste:true}', async () => {
    activate()
    const Page = r.pagesRegistered[0]?.component as ComponentType
    renderUi(<Page />)
    fireEvent.click(screen.getByTestId(T.submitAfterPasteSwitch))
    await waitFor(() => expect(r.updates).toEqual([{ submitAfterPaste: true }]))
    expect(screen.getByTestId(T.submitAfterPasteSwitch)).toHaveAttribute('aria-checked', 'true')
    expect(WT).toBe('wt-1')
  })
})
