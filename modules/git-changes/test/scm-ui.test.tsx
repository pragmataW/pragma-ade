import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GIT_CHANGES_CHANNELS as C,
  type ChangedFile,
  GIT_SCM_CHANNELS as S,
  GitChangesTestIds as T,
} from '../src/contract'
import { type Answers, mountPanel, type PanelHarness, WT_ID } from './helpers/host'
import { EN } from './helpers/i18n'
import { changed, listsAnswer } from './helpers/lists'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const stagedEntry = (path: string): ChangedFile => ({ ...(changed([path])[0] as ChangedFile), staged: true })
const SHA = 'a'.repeat(40)
const row = (path: string, staged = false) =>
  document.querySelector(
    `[data-testid="${T.treeRow}"][data-path="${path}"]${staged ? '[data-staged]' : ':not([data-staged])'}`,
  ) as HTMLElement
const confirms = () => h?.platform.calls.filter((c) => c.method === 'dialogs.confirm').map((c) => c.args[0]) ?? []

async function mount(uncommitted: ChangedFile[], extra: Answers = {}, confirm = true) {
  h = await mountPanel({ answers: { [C.list]: listsAnswer({ uncommitted, branch: [] }), ...extra }, confirm })
  await screen.findByTestId(T.commitMessage)
  return h
}

describe('commit box', () => {
  it('⌘Enter commits the staged changes and clears the message; Commit is off without a message', async () => {
    await mount([stagedEntry('a.ts')])
    expect(screen.getByTestId(T.commitButton)).toBeDisabled()
    const box = screen.getByTestId(T.commitMessage)
    await userEvent.type(box, 'Fix it')
    expect(screen.getByTestId(T.commitButton)).toBeEnabled()
    fireEvent.keyDown(box, { key: 'Enter', metaKey: true })
    await waitFor(() =>
      expect(h?.callsOn(S.commit)).toEqual([
        { worktreeId: WT_ID, message: 'Fix it', amend: false, signoff: false, stageAll: false },
      ]),
    )
    await waitFor(() => expect(box).toHaveValue(''))
    expect(confirms()).toEqual([])
  })

  it('smart commit: nothing staged asks to stage everything; declining commits nothing', async () => {
    await mount(changed(['a.ts']), {}, false)
    await userEvent.type(screen.getByTestId(T.commitMessage), 'all')
    await userEvent.click(screen.getByTestId(T.commitButton))
    await waitFor(() => expect(confirms()).toHaveLength(1))
    expect(confirms()[0]).toMatchObject({ title: EN.scm.confirm.smartCommitTitle, destructive: false })
    expect(h?.callsOn(S.commit)).toEqual([])
    expect(screen.getByTestId(T.commitMessage)).toHaveValue('all')
  })

  it('smart commit confirmed stages everything; the split menu amends and signs off', async () => {
    await mount(changed(['a.ts']))
    await userEvent.type(screen.getByTestId(T.commitMessage), 'all')
    await userEvent.click(screen.getByTestId(T.commitButton))
    await waitFor(() => expect(h?.callsOn(S.commit)).toMatchObject([{ message: 'all', stageAll: true }]))
    await userEvent.click(screen.getByTestId(T.commitMenu))
    await userEvent.click(await screen.findByTestId(T.commitMenuItem('commitAmend')))
    await waitFor(() => expect(h?.callsOn(S.commit)).toHaveLength(2))
    expect(h?.callsOn(S.commit)[1]).toMatchObject({ amend: true, signoff: false, stageAll: false })
  })

  it('a failed operation shows its message and git output until dismissed', async () => {
    await mount([stagedEntry('a.ts')], {
      [S.commit]: () => ({ ok: false, code: 'nothingToCommit', detail: 'nothing to commit, working tree clean' }),
    })
    await userEvent.type(screen.getByTestId(T.commitMessage), 'x')
    await userEvent.click(screen.getByTestId(T.commitButton))
    const banner = await screen.findByTestId(T.scmError)
    expect(banner).toHaveTextContent(EN.scm.errors.nothingToCommit)
    expect(banner).toHaveTextContent('nothing to commit, working tree clean')
    await userEvent.click(within(banner).getByRole('button', { name: EN.scm.dismiss }))
    expect(screen.queryByTestId(T.scmError)).toBeNull()
  })
})

/** `feature` tracking `origin/feature`, two commits behind and one ahead. */
const BEHIND_2_AHEAD_1 = {
  branch: 'feature',
  upstream: 'origin/feature',
  ahead: 1,
  behind: 2,
  hasHead: true,
  hasRemote: true,
}

describe('sync and the … menu', () => {
  it('Sync shows behind/ahead and syncs; without an upstream it publishes', async () => {
    await mount([], { [S.state]: () => BEHIND_2_AHEAD_1 })
    const sync = await screen.findByTestId(T.syncPrimary)
    expect(sync).toHaveTextContent('2↓ 1↑')
    await userEvent.click(sync)
    await waitFor(() => expect(h?.callsOn(S.remote)).toEqual([{ worktreeId: WT_ID, action: 'sync' }]))
  })

  it("with nothing to commit, a pending sync takes the Commit button's place (Sync Changes)", async () => {
    await mount([], { [S.state]: () => BEHIND_2_AHEAD_1 })
    const primary = await screen.findByTestId(T.syncPrimary)
    expect(primary).toHaveTextContent('Sync Changes 2↓ 1↑')
    expect(screen.queryByTestId(T.commitButton)).toBeNull()
    expect(screen.queryByTestId(T.syncButton)).toBeNull()
    await userEvent.type(screen.getByTestId(T.commitMessage), 'x')
    expect(await screen.findByTestId(T.commitButton)).toBeInTheDocument()
    expect(screen.getByTestId(T.syncButton)).toHaveAttribute('data-pending', 'true')
  })

  it('without a remote there is nothing to publish', async () => {
    await mount([], {
      [S.state]: () => ({ branch: 'feature', upstream: null, ahead: 0, behind: 0, hasHead: true, hasRemote: false }),
    })
    expect(await screen.findByTestId(T.commitButton)).toBeInTheDocument()
    expect(screen.queryByTestId(T.syncButton)).toBeNull()
  })

  it('Publish Branch pushes', async () => {
    await mount([], {
      [S.state]: () => ({ branch: 'feature', upstream: null, ahead: 0, behind: 0, hasHead: true, hasRemote: true }),
    })
    const publish = await screen.findByTestId(T.syncPrimary)
    expect(publish).toHaveTextContent(EN.scm.sync.publish)
    await userEvent.click(publish)
    await waitFor(() => expect(h?.callsOn(S.remote)).toEqual([{ worktreeId: WT_ID, action: 'push' }]))
  })

  it('the … menu runs Pull and opens submenus (Changes › Stage All Changes)', async () => {
    await mount(changed(['a.ts']))
    await userEvent.click(screen.getByTestId(T.scmMenu))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('pull')))
    await waitFor(() => expect(h?.callsOn(S.remote)).toEqual([{ worktreeId: WT_ID, action: 'pull' }]))
    await userEvent.click(screen.getByTestId(T.scmMenu))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('changesGroup')))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('stageAll')))
    await waitFor(() => expect(h?.callsOn(S.stage)).toEqual([{ worktreeId: WT_ID }]))
  })

  it('Stash opens one dialog: kind (with file counts) and message, apart from the commit box', async () => {
    await mount([stagedEntry('s.ts'), ...changed(['a.ts'])])
    await userEvent.click(screen.getByTestId(T.scmMenu))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('stashGroup')))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('stashUntracked')))
    const dialog = await screen.findByTestId(T.stashDialog)
    expect(within(dialog).getByTestId(T.stashKind('untracked'))).toHaveAttribute('data-state', 'checked')
    expect(within(dialog).getByTestId(T.stashSubmit)).toHaveTextContent('Stash 2 files')
    await userEvent.click(within(dialog).getByTestId(T.stashKind('staged')))
    expect(within(dialog).getByTestId(T.stashSubmit)).toHaveTextContent('Stash 1 file')
    await userEvent.type(within(dialog).getByTestId(T.stashPrompt), 'wip{Enter}')
    await waitFor(() =>
      expect(h?.callsOn(S.stashPush)).toEqual([
        { worktreeId: WT_ID, message: 'wip', includeUntracked: false, staged: true },
      ]),
    )
    expect(screen.queryByTestId(T.stashDialog)).toBeNull()
    expect(screen.getByTestId(T.commitMessage)).toHaveValue('')
  })
})

describe('row and hunk actions', () => {
  it('a Changes entry stages; a staged entry unstages; the group header stages everything', async () => {
    await mount([stagedEntry('s.ts'), ...changed(['u.ts'])])
    await waitFor(() => expect(row('u.ts')).toBeTruthy())
    await userEvent.click(within(row('u.ts')).getByTestId(T.rowAction('stage')))
    await userEvent.click(within(row('s.ts', true)).getByTestId(T.rowAction('unstage')))
    const changesGroup = screen.getAllByTestId(T.treeRow).find((r) => r.dataset.kind === 'group' && !r.dataset.staged)
    await userEvent.click(within(changesGroup as HTMLElement).getByTestId(T.rowAction('stage')))
    await waitFor(() =>
      expect(h?.callsOn(S.stage)).toEqual([{ worktreeId: WT_ID, paths: ['u.ts'] }, { worktreeId: WT_ID }]),
    )
    expect(h?.callsOn(S.unstage)).toEqual([{ worktreeId: WT_ID, paths: ['s.ts'] }])
  })

  it('discard asks first: an untracked file is a delete, declining does nothing', async () => {
    await mount(changed(['new.txt'], 'U'), {}, false)
    await waitFor(() => expect(row('new.txt')).toBeTruthy())
    await userEvent.click(within(row('new.txt')).getByTestId(T.rowAction('discard')))
    await waitFor(() =>
      expect(confirms()).toMatchObject([
        { title: EN.scm.confirm.deleteTitle, message: expect.stringContaining('new.txt'), destructive: true },
      ]),
    )
    expect(h?.callsOn(S.discard)).toEqual([])
  })

  it('the right-click menu discards a confirmed file', async () => {
    await mount(changed(['a.ts']))
    await waitFor(() => expect(row('a.ts')).toBeTruthy())
    fireEvent.contextMenu(row('a.ts'))
    await userEvent.click(await screen.findByTestId(T.rowMenuItem('discard')))
    await waitFor(() => expect(h?.callsOn(S.discard)).toEqual([{ worktreeId: WT_ID, paths: ['a.ts'] }]))
  })

  it('the diff lists the entry’s hunks with Stage / Discard', async () => {
    const hunk = { header: '@@ -1,3 +1,3 @@', oldStart: 1, oldLines: 3, newStart: 1, newLines: 3 }
    await mount(changed(['a.ts']), {
      [S.hunks]: () => ({ hunks: [hunk] }),
      [C.fileContents]: () => ({
        path: 'a.ts',
        status: 'M',
        old: { kind: 'text', contents: 'a\n' },
        new: { kind: 'text', contents: 'b\n' },
      }),
    })
    const bar = await screen.findByTestId(T.hunks)
    expect(bar).toHaveTextContent('@@ -1,3 +1,3 @@')
    expect(within(bar).queryByTestId(T.hunkAction('unstage'))).toBeNull()
    await userEvent.click(within(bar).getByTestId(T.hunkAction('stage')))
    await waitFor(() =>
      expect(h?.callsOn(S.applyHunk)).toEqual([
        { worktreeId: WT_ID, path: 'a.ts', action: 'stage', header: hunk.header },
      ]),
    )
  })
})

describe('stashes', () => {
  const stashes = { [S.stashList]: () => ({ stashes: [{ index: 0, sha: SHA, message: 'On feature: wip' }] }) }

  it('lists stashes even without changes; a row expands to its files and a file opens its diff', async () => {
    await mount([], {
      ...stashes,
      [S.stashFiles]: () => ({ files: changed(['src/x.ts']) }),
      [C.fileContents]: () => ({
        path: 'src/x.ts',
        status: 'M',
        old: { kind: 'text', contents: 'a\n' },
        new: { kind: 'text', contents: 'b\n' },
      }),
    })
    const section = await screen.findByTestId(T.stashes)
    expect(section).toHaveTextContent('wip')
    expect(section).not.toHaveTextContent('On feature:')
    await userEvent.click(within(section).getByRole('button', { name: /^wip/ }))
    await userEvent.click(await screen.findByTestId(T.stashFile))
    expect(await screen.findByTestId(T.diff)).toHaveAttribute('data-stash', SHA)
    expect(h?.callsOn(C.fileContents).at(-1)).toMatchObject({ path: 'src/x.ts', stash: SHA })
  })

  it('drop asks first, then drops by sha', async () => {
    await mount([], stashes)
    const section = await screen.findByTestId(T.stashes)
    await userEvent.click(within(section).getByTestId(T.stashAction('drop')))
    await waitFor(() => expect(h?.callsOn(S.stash)).toEqual([{ worktreeId: WT_ID, action: 'drop', sha: SHA }]))
    expect(confirms()).toMatchObject([
      { title: EN.scm.confirm.dropTitle, message: expect.stringContaining('On feature: wip') },
    ])
  })
})
