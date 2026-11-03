import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GIT_CHANGES_CHANNELS as C, type ChangedFile, REVEAL_COMMAND_ID, GitChangesTestIds as T } from '../src/contract'
import { useGitChangesStore, viewOf } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'
import { EN } from './helpers/i18n'
import { changed, listsAnswer } from './helpers/lists'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})
const registry = () => h?.host.registries.store.getState()

describe('git-changes renderer module', () => {
  it('registers the tab (order 40, git-compare) and badges the active worktree count', async () => {
    h = await mountPanel({ changedFiles: { [WT_ID]: 4 } })
    expect(registry()?.tabs.map((t) => [t.id, t.order, t.icon, t.titleKey])).toEqual([
      ['git-changes', 40, 'git-compare', 'git-changes:tab.title'],
    ])
    expect(registry()?.badges).toEqual({ 'git-changes': 4 })
  })

  it.each([
    [{}, {}],
    [{ [WT_ID]: 0 }, {}],
  ])('no badge without changes (%o)', async (changedFiles, badges) => {
    h = await mountPanel({ changedFiles })
    expect(registry()?.badges).toEqual(badges)
  })

  it('gitChanges.reveal picks the mode, selects the file and activates the tab', async () => {
    const answer = listsAnswer({ uncommitted: changed(['b.ts']), branch: changed(['a.ts', 'docs/added.md'], 'A') })
    h = await mountPanel({ answers: { [C.list]: answer } })
    await h.host.commands.execute(REVEAL_COMMAND_ID, { worktreeId: WT_ID, path: 'docs/added.md' })
    expect(registry()?.activeTab).toBe('git-changes')
    await waitFor(() =>
      expect(viewOf(useGitChangesStore.getState(), WT_ID)).toMatchObject({
        mode: 'branch',
        selectedPath: 'docs/added.md',
      }),
    )
  })

  it('gitChanges.reveal takes an optional line, side and thread to focus', async () => {
    const answer = listsAnswer({ uncommitted: changed(['b.ts']), branch: [] })
    h = await mountPanel({ answers: { [C.list]: answer } })
    const args = { worktreeId: WT_ID, path: 'b.ts', line: 3, side: 'new', commentId: 'c9' }
    await h.host.commands.execute(REVEAL_COMMAND_ID, args)
    await waitFor(() =>
      expect(viewOf(useGitChangesStore.getState(), WT_ID).focus).toMatchObject({
        line: 3,
        side: 'new',
        commentId: 'c9',
      }),
    )
    await expect(h.host.commands.execute(REVEAL_COMMAND_ID, { ...args, line: 0 })).rejects.toThrow()
  })

  it('gitChanges.reveal rejects a traversal path', async () => {
    h = await mountPanel()
    await expect(h.host.commands.execute(REVEAL_COMMAND_ID, { worktreeId: WT_ID, path: '../x' })).rejects.toThrow()
  })
})

describe('git-changes panel', () => {
  const answers = { [C.list]: listsAnswer({ uncommitted: changed(['b.ts', 'a/x.ts', 'a/y.ts']), branch: [] }) }
  const selected = () => viewOf(useGitChangesStore.getState(), WT_ID).selectedPath

  it('shows the tree and selects the first file in display order', async () => {
    h = await mountPanel({ answers })
    await waitFor(() => expect(selected()).toBe('a/x.ts'))
    const rows = screen.getAllByTestId(T.treeRow)
    expect(rows.map((r) => r.dataset.kind)).toEqual(['group', 'dir', 'file', 'file', 'file'])
    expect(rows[0]).toHaveTextContent(EN.groups.unstaged)
    expect(rows.slice(1).map((r) => r.dataset.path)).toEqual(['a', 'a/x.ts', 'a/y.ts', 'b.ts'])
  })

  it('uncommitted mode groups staged entries above the changes; a path can be in both', async () => {
    const both = [{ ...changed(['b.ts'])[0], staged: true }, ...changed(['b.ts'])] as ChangedFile[]
    h = await mountPanel({ answers: { ...answers, [C.list]: listsAnswer({ uncommitted: both, branch: [] }) } })
    await waitFor(() => expect(screen.getAllByTestId(T.treeRow)).toHaveLength(4))
    const rows = screen.getAllByTestId(T.treeRow)
    expect(rows.map((r) => [r.dataset.kind, r.dataset.path, r.dataset.staged])).toEqual([
      ['group', '', 'true'],
      ['file', 'b.ts', 'true'],
      ['group', '', undefined],
      ['file', 'b.ts', undefined],
    ])
    expect(rows[0]).toHaveTextContent(EN.groups.staged)
  })

  it('j and k move the selection through the display order', async () => {
    h = await mountPanel({ answers })
    await waitFor(() => expect(selected()).toBe('a/x.ts'))
    const panel = screen.getByTestId(T.panel)
    fireEvent.keyDown(panel, { key: 'j' })
    fireEvent.keyDown(panel, { key: 'j' })
    expect(selected()).toBe('b.ts')
    fireEvent.keyDown(panel, { key: 'j' })
    expect(selected()).toBe('b.ts')
    fireEvent.keyDown(panel, { key: 'k' })
    expect(selected()).toBe('a/y.ts')
  })

  it.each([
    [null, 'noWorktree'],
    [undefined, 'noChanges'],
  ])('empty state %s → %s', async (active, kind) => {
    h = await mountPanel({ active, answers: { [C.list]: listsAnswer({ uncommitted: [], branch: [] }) } })
    await waitFor(() => expect(screen.getByTestId(T.empty)).toHaveAttribute('data-kind', kind))
  })
})
