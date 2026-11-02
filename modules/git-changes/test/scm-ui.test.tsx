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

describe('sync and the … menu', () => {
  it('Sync shows behind/ahead and syncs; without an upstream it publishes', async () => {
    await mount([], {
      [S.state]: () => ({ branch: 'feature', upstream: 'origin/feature', ahead: 1, behind: 2, hasHead: true }),
    })
    const sync = await screen.findByTestId(T.syncButton)
    expect(sync).toHaveTextContent('2↓ 1↑')
    await userEvent.click(sync)
    await waitFor(() => expect(h?.callsOn(S.remote)).toEqual([{ worktreeId: WT_ID, action: 'sync' }]))
  })

  it('Publish Branch pushes', async () => {
    await mount([], { [S.state]: () => ({ branch: 'feature', upstream: null, ahead: 0, behind: 0, hasHead: true }) })
    const publish = await screen.findByTestId(T.syncButton)
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

  it('Stash asks for a message (Enter stashes)', async () => {
    await mount(changed(['a.ts']))
    await userEvent.click(screen.getByTestId(T.scmMenu))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('stashGroup')))
    await userEvent.click(await screen.findByTestId(T.scmMenuItem('stashUntracked')))
    const prompt = await screen.findByTestId(T.stashPrompt)
    await userEvent.type(prompt, 'wip{Enter}')
    await waitFor(() =>
      expect(h?.callsOn(S.stashPush)).toEqual([
        { worktreeId: WT_ID, message: 'wip', includeUntracked: true, staged: false },
      ]),
    )
    expect(screen.queryByTestId(T.stashPrompt)).toBeNull()
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
    expect(section).toHaveTextContent('On feature: wip')
    await userEvent.click(within(section).getByRole('button', { name: /On feature: wip/ }))
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
