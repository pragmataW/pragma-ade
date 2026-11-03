import { act, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'
import { BROWSER_OPEN_COMMAND, EDITOR_OPEN_FILE_COMMAND, GIT_CHANGES_REVEAL_COMMAND } from '../../src/constants'
import { type Comment, COMMENTS_TESTIDS as T } from '../../src/contract'
import { CommentRow } from '../../src/renderer/components/CommentRow'
import { aThread } from '../../src/testing'
import { WT } from '../factories'
import { type MountedRenderer, mountRenderer } from '../fakes'
import { renderUi } from './render'

let r: MountedRenderer
afterEach(() => r.stop())

const ALL = [EDITOR_OPEN_FILE_COMMAND, GIT_CHANGES_REVEAL_COMMAND, BROWSER_OPEN_COMMAND]
function mount(thread: Comment, commands: readonly string[] = ALL) {
  r = mountRenderer()
  for (const id of commands) r.commands.register(id, () => undefined)
  r.store.getState().openDrawer()
  renderUi(<CommentRow comment={thread} />)
}
const executed = () => r.executed

const BROWSER_ELEMENT = {
  url: 'http://localhost:5173/settings?tab=1',
  selector: 'button.save',
  outerHtml: '<button class="save">Save</button>',
  boundingBox: { x: 0, y: 0, width: 10, height: 10 },
}

describe('thread links in the drawer', () => {
  test('a diff thread: Show in Git Changes (focused on the thread) and Open in editor; each closes the drawer', () => {
    const t = aThread({ id: 'd1', worktreeId: WT, filePath: 'src/a.ts', lineStart: 3, lineEnd: 5, diffSide: 'new' })
    mount(t)
    fireEvent.click(screen.getByTestId(T.linkGitChanges))
    expect(executed()).toEqual([
      [GIT_CHANGES_REVEAL_COMMAND, { worktreeId: WT, path: 'src/a.ts', line: 3, side: 'new', commentId: 'd1' }],
    ])
    expect(r.store.getState().drawer.open).toBe(false)
    fireEvent.click(screen.getByTestId(T.linkEditor))
    expect(executed()[1]).toEqual([EDITOR_OPEN_FILE_COMMAND, { worktreeId: WT, path: 'src/a.ts', line: 3 }])
  })

  test('the location label follows the first link', () => {
    mount(aThread({ id: 'd2', worktreeId: WT, filePath: 'src/a.ts', lineStart: 7, diffSide: 'new' }))
    fireEvent.click(screen.getByTestId(T.threadLocationLink))
    expect(executed()[0]?.[0]).toBe(GIT_CHANGES_REVEAL_COMMAND)
  })

  test('an old-side diff thread has no editor link (the line is gone from the file)', () => {
    mount(aThread({ id: 'd3', worktreeId: WT, diffSide: 'old' }))
    expect(screen.getByTestId(T.linkGitChanges)).toBeInTheDocument()
    expect(screen.queryByTestId(T.linkEditor)).toBeNull()
  })

  test('an editor thread opens the file at its line', () => {
    mount(aThread({ id: 'e1', worktreeId: WT, source: 'editor', filePath: 'lib/b.ts', lineStart: 9 }))
    expect(screen.queryByTestId(T.linkGitChanges)).toBeNull()
    fireEvent.click(screen.getByTestId(T.linkEditor))
    expect(executed()).toEqual([[EDITOR_OPEN_FILE_COMMAND, { worktreeId: WT, path: 'lib/b.ts', line: 9 }]])
  })

  test('a browser thread opens its page', () => {
    const t = aThread({ id: 'b1', worktreeId: WT, source: 'browser', filePath: undefined, element: BROWSER_ELEMENT })
    mount(t)
    fireEvent.click(screen.getByTestId(T.linkBrowser))
    expect(executed()).toEqual([[BROWSER_OPEN_COMMAND, { worktreeId: WT, url: BROWSER_ELEMENT.url }]])
  })

  test('links whose command is not registered are left out, and appear once it is', () => {
    mount(aThread({ id: 'd4', worktreeId: WT }), [])
    expect(screen.queryByTestId(T.linkGitChanges)).toBeNull()
    expect(screen.queryByTestId(T.threadLocationLink)).toBeNull()
    act(() => void r.commands.register(GIT_CHANGES_REVEAL_COMMAND, () => undefined))
    expect(screen.getByTestId(T.linkGitChanges)).toBeInTheDocument()
  })
})
