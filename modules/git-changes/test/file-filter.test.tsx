import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GIT_CHANGES_CHANNELS as C,
  type ChangedFile,
  GIT_SCM_CHANNELS as S,
  GitChangesTestIds as T,
} from '../src/contract'
import { useGitChangesStore } from '../src/renderer/store'
import { mountPanel, type PanelHarness, WT_ID } from './helpers/host'
import { EN } from './helpers/i18n'
import { changed, listsAnswer } from './helpers/lists'

/** The mounted panel of the running test (disposed after it). */
const mounted: { panel?: PanelHarness } = {}
afterEach(() => mounted.panel?.dispose())
const calls = (channel: string) => mounted.panel?.callsOn(channel)

const NFD_SUBE = `${'ş'.normalize('NFD')}ube.ts`
const UNSTAGED = changed(['şirket/ödeme_işlemi.ts', 'İçerik.md', 'src/main.ts', 'src/odeme.ts', NFD_SUBE])
const STAGED: ChangedFile = { ...(UNSTAGED[2] as ChangedFile), staged: true }
const SHA = 'b'.repeat(40)

async function open(extra: Record<string, (input: never) => unknown> = {}) {
  mounted.panel = await mountPanel({
    answers: { [C.list]: listsAnswer({ uncommitted: [STAGED, ...UNSTAGED], branch: [] }), ...extra },
  })
  return (await screen.findByTestId(T.filterInput)) as HTMLInputElement
}

const fileRows = () =>
  screen
    .queryAllByTestId(T.treeRow)
    .filter((r) => r.dataset.kind === 'file')
    .map((r) => `${r.dataset.staged ? 'staged:' : ''}${r.dataset.path}`)
const group = (staged: boolean) =>
  screen.getAllByTestId(T.treeRow).find((r) => r.dataset.kind === 'group' && Boolean(r.dataset.staged) === staged)
const marks = (path: string) =>
  Array.from(
    document.querySelectorAll(`[data-testid="${T.treeRow}"][data-path="${path}"] [data-testid="${T.filterMatch}"]`),
    (m) => m.textContent,
  )

describe('changed-files filter', () => {
  it('typing filters staged and unstaged entries; groups and the bar count matches', async () => {
    const input = await open()
    await waitFor(() => expect(fileRows()).toHaveLength(6))
    expect(input).toHaveAttribute('placeholder', EN.filter.placeholder)
    await userEvent.type(input, 'src')
    expect(fileRows()).toEqual(['staged:src/main.ts', 'src/main.ts', 'src/odeme.ts'])
    expect(screen.getByTestId(T.filterCount)).toHaveTextContent('3 of 6')
    expect(group(true)).toHaveTextContent('1 of 1')
    expect(group(false)).toHaveTextContent('2 of 5')
  })

  it('Turkish letters: İ/ı/I fold together, an NFD file name matches and highlights whole letters', async () => {
    const input = await open()
    await userEvent.type(input, 'içerik')
    expect(fileRows()).toEqual(['İçerik.md'])
    expect(marks('İçerik.md')).toEqual(['İçerik'])
    await userEvent.clear(input)
    await userEvent.type(input, 'şu')
    expect(fileRows()).toEqual([NFD_SUBE])
    expect(marks(NFD_SUBE)).toEqual([`${'ş'.normalize('NFD')}u`])
  })

  it('diacritic-insensitive matches come after exact ones (list view keeps the rank order)', async () => {
    const input = await open()
    await userEvent.click(screen.getByTestId(T.toggleView))
    await userEvent.type(input, 'ödeme')
    expect(fileRows()).toEqual(['şirket/ödeme_işlemi.ts', 'src/odeme.ts'])
    expect(marks('src/odeme.ts')).toEqual(['odeme'])
  })

  it('the clear button and Escape empty the query; a second Escape leaves the field', async () => {
    const input = await open()
    await userEvent.type(input, 'src')
    await userEvent.click(screen.getByTestId(T.filterClear))
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    expect(fileRows()).toHaveLength(6)
    await userEvent.type(input, 'main{Escape}')
    expect(input).toHaveValue('')
    expect(input).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    expect(input).not.toHaveFocus()
  })

  it('nothing matches: an empty state with its own way back', async () => {
    const input = await open()
    await userEvent.type(input, 'zzz')
    expect(fileRows()).toEqual([])
    const empty = screen.getByTestId(T.empty)
    expect(empty).toHaveAttribute('data-kind', 'noMatches')
    await userEvent.click(within(empty).getByTestId(T.filterReset))
    expect(input).toHaveValue('')
    expect(fileRows()).toHaveLength(6)
  })

  it('Enter selects the best match; the selection survives filtering it out', async () => {
    const input = await open()
    await userEvent.type(input, 'icerik{Enter}')
    const selected = () => useGitChangesStore.getState().views[WT_ID]?.selectedPath
    expect(selected()).toBe('İçerik.md')
    await userEvent.clear(input)
    await userEvent.type(input, 'src')
    expect(selected()).toBe('İçerik.md')
  })

  it('Cmd/Ctrl+Alt+F focuses the filter (Cmd/Ctrl+F stays find in diff); kept per worktree', async () => {
    const input = await open()
    await userEvent.click(screen.getAllByTestId(T.treeRow)[1] as HTMLElement)
    await userEvent.keyboard('{Meta>}{Alt>}f{/Alt}{/Meta}')
    expect(input).toHaveFocus()
    await userEvent.type(input, 'main')
    expect(useGitChangesStore.getState().views[WT_ID]?.filter).toBe('main')
  })

  it('a filtered group stages, unstages and discards only its matching entries, labelled so', async () => {
    const input = await open()
    await userEvent.type(input, 'src')
    const changes = group(false) as HTMLElement
    const stage = within(changes).getByTestId(T.rowAction('stage'))
    expect(stage).toHaveAccessibleName(EN.scm.row.stageMatching)
    await userEvent.click(stage)
    await userEvent.click(within(changes).getByTestId(T.rowAction('discard')))
    await userEvent.click(within(group(true) as HTMLElement).getByTestId(T.rowAction('unstage')))
    const paths = { worktreeId: WT_ID, paths: ['src/main.ts', 'src/odeme.ts'] }
    await waitFor(() => expect(calls(S.discard)).toEqual([paths]))
    expect(calls(S.stage)).toEqual([paths])
    expect(calls(S.unstage)).toEqual([{ worktreeId: WT_ID, paths: ['src/main.ts'] }])
  })

  it("an expanded stash lists only its matching files, counted 'n of m'", async () => {
    const input = await open({
      [S.stashList]: () => ({ stashes: [{ index: 0, sha: SHA, message: 'On feature: wip' }] }),
      [S.stashFiles]: () => ({ files: changed(['src/a.ts', 'docs/ödeme.md']) }),
    })
    const section = await screen.findByTestId(T.stashes)
    await userEvent.click(within(section).getByRole('button', { name: /^wip/ }))
    await waitFor(() => expect(within(section).getAllByTestId(T.stashFile)).toHaveLength(2))
    await userEvent.type(input, 'odeme')
    const files = within(section).getAllByTestId(T.stashFile)
    expect(files.map((f) => f.dataset.path)).toEqual(['docs/ödeme.md'])
    expect(within(section).getByTestId(T.stashFileCount)).toHaveTextContent('1 of 2')
  })
})
