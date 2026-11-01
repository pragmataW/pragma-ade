import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GIT_CHANGES_CHANNELS as C,
  type ChangedFile,
  type ChangeList,
  type ChangeMode,
  GitChangesTestIds as T,
} from '../src/contract'
import { type Answers, mountPanel, type PanelHarness, WT_ID } from './helpers/host'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const files = (...paths: string[]): ChangedFile[] =>
  paths.map((path) => ({ path, status: 'M', additions: 1, deletions: 1, binary: false }))
const okList = (mode: ChangeMode, f: ChangedFile[], baseBranch = 'main'): ChangeList => ({
  state: 'ok',
  worktreeId: WT_ID,
  mode,
  baseBranch,
  mergeBase: mode === 'branch' ? '0123456789abcdef' : null,
  headSha: 'feedface',
  commitCount: mode === 'branch' ? 2 : null,
  files: f,
  totals: { files: f.length, additions: f.length, deletions: f.length },
})
const lists = (branch: ChangeList): Answers => ({
  [C.list]: (i: { mode: ChangeMode }) =>
    i.mode === 'branch' ? branch : okList('uncommitted', files('a', 'b', 'c', 'd')),
  [C.listBranches]: () => ({
    branches: [
      { name: 'main', kind: 'local' },
      { name: 'develop', kind: 'local' },
      { name: 'origin/main', kind: 'remote' },
    ],
  }),
  [C.setBaseBranch]: () => ({}),
})

async function openBranchMode(answers: Answers) {
  h = await mountPanel({ answers })
  await userEvent.click(await screen.findByTestId(T.mode('branch')))
  return h
}

describe('git-changes toolbar', () => {
  it('the mode toggle shows both counts', async () => {
    h = await mountPanel({ answers: lists(okList('branch', files('x', 'y', 'z', 'v', 'w'))) })
    await waitFor(() => expect(screen.getByTestId(T.mode('uncommitted'))).toHaveTextContent('Uncommitted(4)'))
    await waitFor(() => expect(screen.getByTestId(T.mode('branch'))).toHaveTextContent('Committed on branch(5)'))
  })

  it('the uncommitted count falls back to the projects count while loading', async () => {
    h = await mountPanel({ answers: { [C.list]: () => new Promise(() => undefined) }, changedFiles: { [WT_ID]: 7 } })
    expect(await screen.findByTestId(T.mode('uncommitted'))).toHaveTextContent('(7)')
  })

  it('toolbar shows base error state', async () => {
    await openBranchMode(lists({ state: 'baseNotFound', worktreeId: WT_ID, mode: 'branch', baseBranch: 'nope' }))
    expect(await screen.findByTestId(T.baseError)).toHaveTextContent('Base branch nope was not found')
    expect(screen.getByTestId(T.basePicker)).toBeEnabled()
    expect(screen.getByTestId(T.basePicker)).toHaveTextContent('vs nope')
  })

  it('branch mode shows base, commits, merge-base and totals', async () => {
    await openBranchMode(lists(okList('branch', files('x', 'y'))))
    const toolbar = (await screen.findByTestId(T.basePicker)).parentElement as HTMLElement
    await waitFor(() => expect(toolbar).toHaveTextContent('vs main· 2 commits · merge-base 0123456'))
    expect(screen.getByTestId(T.totals)).toHaveTextContent('2 files · +2 −2')
  })

  it('choosing develop invokes git-changes.setBaseBranch', async () => {
    await openBranchMode(lists(okList('branch', files('x'))))
    await waitFor(() => expect(h?.callsOn(C.listBranches)).toHaveLength(1))
    await userEvent.click(await screen.findByTestId(T.basePicker))
    await userEvent.click(within(await screen.findByRole('listbox')).getByText('develop'))
    await waitFor(() => expect(h?.callsOn(C.setBaseBranch)).toEqual([{ worktreeId: WT_ID, baseBranch: 'develop' }]))
  })

  it('the view toggles write the module settings', async () => {
    h = await mountPanel({ answers: lists(okList('branch', files('x'))) })
    await userEvent.click(await screen.findByTestId(T.toggleStyle))
    await waitFor(() => expect(h?.main.host.settings.get('git-changes')).toMatchObject({ diffStyle: 'split' }))
    expect(screen.getByTestId(T.toggleStyle)).toHaveAttribute('aria-pressed', 'true')
  })
})
