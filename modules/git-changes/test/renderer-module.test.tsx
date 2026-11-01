import { waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { GIT_CHANGES_CHANNELS as C, REVEAL_COMMAND_ID } from '../src/contract'
import { useGitChangesStore, viewOf } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'

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
    const listFor = (mode: string, paths: string[]) => ({
      state: 'ok',
      worktreeId: WT_ID,
      mode,
      baseBranch: 'main',
      mergeBase: null,
      headSha: null,
      commitCount: null,
      files: paths.map((path) => ({ path, status: 'A', additions: 1, deletions: 0, binary: false })),
      totals: { files: paths.length, additions: paths.length, deletions: 0 },
    })
    const answer = (i: { mode: string }) => listFor(i.mode, i.mode === 'branch' ? ['a.ts', 'docs/added.md'] : ['b.ts'])
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
