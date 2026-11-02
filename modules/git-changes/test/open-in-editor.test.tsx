import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { EDITOR_OPEN_DIFF_COMMAND } from '../src/constants'
import { GIT_CHANGES_CHANNELS as C, type FileDiffContents, GitChangesTestIds as T } from '../src/contract'
import { openDiffArgs } from '../src/renderer/lib/editor'
import { useGitChangesStore } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'
import { changed, listsAnswer } from './helpers/lists'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const [MODIFIED] = changed(['src/app.ts'])
const RENAMED = { ...changed(['src/new.ts'], 'R')[0], oldPath: 'src/old.ts' } as NonNullable<typeof MODIFIED>
const SHA = '0123456789abcdef'

describe('openDiffArgs', () => {
  it('uncommitted: path and line, no refs (the SCM change)', () => {
    expect(openDiffArgs({ worktreeId: WT_ID, mode: 'uncommitted', mergeBase: null }, MODIFIED as never, 3)).toEqual({
      worktreeId: WT_ID,
      path: 'src/app.ts',
      line: 3,
    })
  })

  it('branch: merge-base ↔ HEAD and the rename source', () => {
    expect(openDiffArgs({ worktreeId: WT_ID, mode: 'branch', mergeBase: SHA }, RENAMED)).toEqual({
      worktreeId: WT_ID,
      path: 'src/new.ts',
      oldPath: 'src/old.ts',
      refs: { old: SHA, new: 'HEAD' },
    })
  })
})

const contents: FileDiffContents = {
  path: 'src/app.ts',
  status: 'M',
  old: { kind: 'binary' },
  new: { kind: 'binary' },
}
const answers = {
  [C.list]: listsAnswer({ uncommitted: changed(['src/app.ts']), branch: changed(['docs/added.md'], 'A') }),
  [C.fileContents]: () => contents,
}

async function mountWithEditor() {
  const calls: unknown[] = []
  h = await mountPanel({ answers, commands: { [EDITOR_OPEN_DIFF_COMMAND]: (args) => void calls.push(args) } })
  await screen.findByTestId(T.diff)
  return calls
}

const row = (path: string) => screen.getAllByTestId(T.treeRow).find((r) => r.dataset.path === path) as HTMLElement

describe('Open in editor (git diff)', () => {
  it('is hidden without editor.openDiff: no header button, no row menu', async () => {
    h = await mountPanel({ answers })
    await screen.findByTestId(T.diff)
    expect(screen.queryByTestId(T.openInEditor)).toBeNull()
    fireEvent.contextMenu(row('src/app.ts'))
    expect(screen.queryByTestId(T.rowMenu)).toBeNull()
  })

  it('header icon button (tooltip + aria-label) opens the diff and switches to the Files tab', async () => {
    const calls = await mountWithEditor()
    const button = screen.getByTestId(T.openInEditor)
    expect(button).toHaveAttribute('aria-label', 'Open diff in editor')
    expect(button).toHaveAttribute('title', 'Open diff in editor')
    fireEvent.click(button)
    await waitFor(() => expect(calls).toEqual([{ worktreeId: WT_ID, path: 'src/app.ts', line: 1 }]))
    await waitFor(() => expect(h?.host.registries.store.getState().activeTab).toBe('files'))
  })

  it('row context menu in branch mode asks for merge-base ↔ HEAD', async () => {
    const calls = await mountWithEditor()
    useGitChangesStore.getState().setMode(WT_ID, 'branch')
    await waitFor(() => expect(row('docs/added.md')).toBeTruthy())
    fireEvent.contextMenu(row('docs/added.md'), { clientX: 20, clientY: 30 })
    fireEvent.click(await screen.findByTestId(T.rowMenuOpenInEditor))
    await waitFor(() =>
      expect(calls).toEqual([{ worktreeId: WT_ID, path: 'docs/added.md', refs: { old: SHA, new: 'HEAD' } }]),
    )
    expect(screen.queryByTestId(T.rowMenu)).toBeNull()
  })
})
