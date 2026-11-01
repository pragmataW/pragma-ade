import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GIT_CHANGES_CHANNELS as C, REVEAL_COMMAND_ID, GitChangesTestIds as T } from '../src/contract'
import { useGitChangesStore, viewOf } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'
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
    expect(screen.getAllByTestId(T.treeRow).map((r) => r.dataset.path)).toEqual(['a', 'a/x.ts', 'a/y.ts', 'b.ts'])
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
