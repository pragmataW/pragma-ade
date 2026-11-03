import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { WORKTREE_DRAG_TYPE } from '../src/constants'
import { PROJECTS_CHANNELS as C, PROJECTS_TESTIDS as T, type WorktreeFolder } from '../src/contract'
import { aProject, aWorktree } from './support/builders'
import { mountSidebar, type SidebarHarness, STATUS_PROBE_TESTID } from './support/sidebar-harness'

const project = { ...aProject({ id: 'p', name: 'app' }), sortOrder: 0 }
const main = aWorktree('p', { id: 'm', branch: 'main', isMain: true })
const login = aWorktree('p', { id: 'l', branch: 'feat/login' })
const docs = aWorktree('p', { id: 'd', branch: 'docs' })
const reviews: WorktreeFolder = { id: 'r', name: 'Reviews', collapsed: false, worktreeIds: ['l'] }
const empty: WorktreeFolder = { id: 'e', name: 'Empty', collapsed: false, worktreeIds: [] }

const mounted: { h?: SidebarHarness } = {}
afterEach(async () => {
  await mounted.h?.dispose()
  mounted.h = undefined
})

async function mount(folders: WorktreeFolder[] = [reviews, empty], answers = {}) {
  mounted.h = await mountSidebar(
    { projects: [project], worktrees: [main, login, docs], folders: { p: folders }, activeWorktreeId: 'm' },
    answers,
  )
  return mounted.h
}

const folderItem = (name: string) =>
  screen.getAllByTestId(T.folder).find((f) => f.dataset.folderName === name) as HTMLElement
const row = (branch: string) =>
  screen.getAllByTestId(T.worktreeRow).find((r) => r.dataset.branch === branch) as HTMLElement
const branchesIn = (el: HTMLElement) =>
  within(el)
    .queryAllByTestId(T.worktreeRow)
    .map((r) => r.dataset.branch)
/** Replaces the store's folders, as a `foldersChanged` event would. */
const setFolders = (h: SidebarHarness, folders: WorktreeFolder[]) =>
  act(() => h.runtime.store.setState({ folders: { p: folders } }))

async function openRowMenu(branch: string) {
  await userEvent.click(within(row(branch)).getByTestId(T.worktreeMenu))
  await userEvent.click(await screen.findByTestId(T.moveToFolder))
}

describe('sidebar folders', () => {
  it('renders a tree: folders first (name, count, level 1), their members at level 2, the rest at the root', async () => {
    await mount()
    const tree = screen.getByRole('tree', { name: 'app' })
    const items = within(tree).getAllByRole('treeitem')
    expect(items.map((i) => i.dataset.folderName ?? i.dataset.branch)).toEqual([
      'Reviews',
      'feat/login',
      'Empty',
      'main',
      'docs',
    ])
    expect(folderItem('Reviews')).toHaveAttribute('aria-label', 'Reviews, 1 worktree')
    expect(within(folderItem('Empty')).getByTestId(T.folderCount)).toHaveTextContent('0')
    expect(branchesIn(folderItem('Reviews'))).toEqual(['feat/login'])
    expect(row('feat/login')).toHaveAttribute('aria-level', '2')
    expect(row('docs')).toHaveAttribute('aria-level', '1')
    expect(row('main')).toHaveAttribute('aria-selected', 'true')
  })

  it('clicking the header collapses through IPC; a collapsed folder hides its group and shows member status', async () => {
    const h = await mount()
    expect(folderItem('Reviews')).toHaveAttribute('aria-expanded', 'true')
    const headerOf = () => within(folderItem('Reviews')).getByTestId(T.folderHeader)
    expect(within(headerOf()).queryByTestId(STATUS_PROBE_TESTID)).toBeNull()
    await userEvent.click(headerOf())
    expect(h.callsOn(C.setFolderCollapsed)).toEqual([{ projectId: 'p', folderId: 'r', collapsed: true }])
    expect(folderItem('Reviews')).toHaveFocus()
    setFolders(h, [{ ...reviews, collapsed: true }, empty])
    const folder = folderItem('Reviews')
    expect(folder).toHaveAttribute('aria-expanded', 'false')
    expect(within(folder).getByRole('group', { hidden: true })).toHaveAttribute('inert')
    expect(within(headerOf()).getByTestId(STATUS_PROBE_TESTID)).toHaveTextContent('l')
  })

  it.each([
    ['{Enter}', false, { collapsed: true }],
    [' ', false, { collapsed: true }],
    ['{ArrowLeft}', false, { collapsed: true }],
    ['{ArrowRight}', true, { collapsed: false }],
    ['{ArrowRight}', false, null],
  ])('keyboard %s on a folder (collapsed=%s) sends %j', async (key, collapsed, sent) => {
    const h = await mount([{ ...reviews, collapsed }])
    folderItem('Reviews').focus()
    await userEvent.keyboard(key)
    const expected = sent ? [{ projectId: 'p', folderId: 'r', ...sent }] : []
    expect(h.callsOn(C.setFolderCollapsed)).toEqual(expected)
  })

  it('F2 opens the rename dialog with the name; saving renames the folder', async () => {
    const h = await mount()
    folderItem('Reviews').focus()
    await userEvent.keyboard('{F2}')
    const input = await screen.findByTestId(T.folderName)
    expect(input).toHaveValue('Reviews')
    await userEvent.clear(input)
    expect(screen.getByTestId(T.folderSubmit)).toBeDisabled()
    await userEvent.type(input, 'Code review{Enter}')
    expect(h.callsOn(C.renameFolder)).toEqual([{ projectId: 'p', folderId: 'r', name: 'Code review' }])
    await waitFor(() => expect(screen.queryByTestId(T.folderDialog)).toBeNull())
  })

  it('folder menu: delete sends deleteFolder', async () => {
    const h = await mount()
    await userEvent.click(within(folderItem('Empty')).getByTestId(T.folderMenu))
    await userEvent.click(await screen.findByTestId(T.folderDelete))
    expect(h.callsOn(C.deleteFolder)).toEqual([{ projectId: 'p', folderId: 'e' }])
  })

  it('project menu: New folder… creates an empty folder', async () => {
    const h = await mount([])
    await userEvent.click(screen.getByTestId(T.projectMenu))
    await userEvent.click(await screen.findByTestId(T.projectNewFolder))
    await userEvent.type(await screen.findByTestId(T.folderName), ' Spikes {Enter}')
    expect(h.callsOn(C.createFolder)).toEqual([{ projectId: 'p', name: ' Spikes ' }])
  })

  it('row menu: Move to folder lists the other folders and moves there', async () => {
    const h = await mount()
    await openRowMenu('feat/login')
    const targets = await screen.findAllByTestId(T.moveToFolderTarget)
    expect(targets.map((t) => t.dataset.folderName)).toEqual(['Empty'])
    await userEvent.click(targets[0] as HTMLElement)
    expect(h.callsOn(C.moveWorktreeToFolder)).toEqual([{ worktreeId: 'l', folderId: 'e' }])
  })

  it('row menu: Remove from folder moves to the root; New folder… creates one with the worktree in it', async () => {
    const h = await mount()
    await openRowMenu('feat/login')
    await userEvent.click(await screen.findByTestId(T.removeFromFolder))
    expect(h.callsOn(C.moveWorktreeToFolder)).toEqual([{ worktreeId: 'l', folderId: null }])
    await openRowMenu('main')
    expect(screen.queryByTestId(T.removeFromFolder)).toBeNull()
    await userEvent.click(await screen.findByTestId(T.moveToNewFolder))
    await userEvent.type(await screen.findByTestId(T.folderName), 'Base{Enter}')
    expect(h.callsOn(C.createFolder)).toEqual([{ projectId: 'p', name: 'Base', worktreeId: 'm' }])
  })

  it('a failed create keeps the dialog open with the error', async () => {
    const error = { ok: false, error: { code: 'invalidFolderName' } }
    await mount([], { [C.createFolder]: () => error })
    await userEvent.click(screen.getByTestId(T.projectMenu))
    await userEvent.click(await screen.findByTestId(T.projectNewFolder))
    await userEvent.type(await screen.findByTestId(T.folderName), 'x{Enter}')
    expect(await within(screen.getByTestId(T.folderDialog)).findByRole('alert')).toHaveTextContent(/64 characters/)
  })
})

/** A drag of `source` dropped on `target` (native HTML5 drag and drop with a shared DataTransfer). */
function drag(source: HTMLElement, target: HTMLElement) {
  const data = new Map<string, string>()
  const dataTransfer = {
    get types() {
      return [...data.keys()]
    },
    setData: (type: string, value: string) => data.set(type, value),
    getData: (type: string) => data.get(type) ?? '',
    dropEffect: 'none',
    effectAllowed: 'all',
  }
  fireEvent.dragStart(source, { dataTransfer })
  fireEvent.dragOver(target, { dataTransfer })
  fireEvent.drop(target, { dataTransfer })
  return data
}

describe('sidebar folders: drag and drop', () => {
  it('dropping a row on a folder moves it in; on the tree outside folders, back to the root', async () => {
    const h = await mount()
    expect(drag(row('docs'), folderItem('Empty')).get(WORKTREE_DRAG_TYPE)).toBe('d')
    drag(row('feat/login'), screen.getByTestId(T.worktreeTree))
    expect(h.callsOn(C.moveWorktreeToFolder)).toEqual([
      { worktreeId: 'd', folderId: 'e' },
      { worktreeId: 'l', folderId: null },
    ])
  })

  it('dropping where the worktree already is, or a foreign drag, does nothing', async () => {
    const h = await mount()
    drag(row('feat/login'), folderItem('Reviews'))
    drag(row('docs'), screen.getByTestId(T.worktreeTree))
    fireEvent.drop(folderItem('Empty'), { dataTransfer: { types: ['text/plain'], getData: () => 'd' } })
    expect(h.callsOn(C.moveWorktreeToFolder)).toEqual([])
  })
})

describe('sidebar folders: filter', () => {
  it('hides folders without matches and opens collapsed folders that have some', async () => {
    await mount([{ ...reviews, collapsed: true }, empty])
    await userEvent.click(screen.getByTestId(T.filterToggle))
    await userEvent.type(screen.getByTestId(T.filterInput), 'login')
    expect(screen.getAllByTestId(T.folder).map((f) => f.dataset.folderName)).toEqual(['Reviews'])
    expect(folderItem('Reviews')).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getAllByTestId(T.worktreeRow).map((r) => r.dataset.branch)).toEqual(['feat/login'])
  })
})
