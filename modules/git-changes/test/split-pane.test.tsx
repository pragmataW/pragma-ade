import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { TREE_COLLAPSED_LAYOUT_KEY } from '../src/constants'
import { GIT_CHANGES_CHANNELS as C, GitChangesTestIds as T, TOGGLE_FILE_LIST_COMMAND_ID } from '../src/contract'
import { useGitChangesStore } from '../src/renderer/store'
import { mountPanel, type PanelHarness } from './helpers/host'
import { EN } from './helpers/i18n'
import { changed, listsAnswer } from './helpers/lists'

let h: PanelHarness | undefined
afterEach(async () => {
  await h?.dispose()
  h = undefined
})

const answers = { [C.list]: listsAnswer({ uncommitted: changed(['a.ts']), branch: [] }) }
const pane = () => screen.getByTestId(T.treePane)
const toggle = () => screen.getByTestId(T.toggleTree)

async function mounted() {
  h = await mountPanel({ answers })
  await screen.findByTestId(T.treePane)
  return h
}

describe('collapsible file list', () => {
  it('the toolbar toggle collapses and expands the list and persists the state', async () => {
    const harness = await mounted()
    expect(pane()).toHaveAttribute('data-collapsed', 'false')
    expect(toggle()).toHaveAttribute('aria-label', EN.toolbar.hideFileList)
    await userEvent.click(toggle())
    expect(pane()).toHaveAttribute('data-collapsed', 'true')
    expect(toggle()).toHaveAttribute('aria-pressed', 'false')
    expect(toggle()).toHaveAttribute('aria-label', EN.toolbar.showFileList)
    expect(harness.host.layout.get(TREE_COLLAPSED_LAYOUT_KEY)).toBe('1')
    await userEvent.click(toggle())
    expect(pane()).toHaveAttribute('data-collapsed', 'false')
    expect(harness.host.layout.get(TREE_COLLAPSED_LAYOUT_KEY)).toBe('0')
  })

  it('gitChanges.toggleFileList and a separator double-click toggle it too', async () => {
    const harness = await mounted()
    await harness.host.commands.execute(TOGGLE_FILE_LIST_COMMAND_ID)
    await waitFor(() => expect(pane()).toHaveAttribute('data-collapsed', 'true'))
    fireEvent.doubleClick(screen.getByTestId(T.treeSeparator))
    await waitFor(() => expect(pane()).toHaveAttribute('data-collapsed', 'false'))
  })

  it('reads the collapsed state from the saved layout until the store knows it', async () => {
    const harness = await mounted()
    harness.host.layout.set(TREE_COLLAPSED_LAYOUT_KEY, '1')
    act(() => useGitChangesStore.setState({ treeCollapsed: null }))
    await waitFor(() => expect(pane()).toHaveAttribute('data-collapsed', 'true'))
    expect(useGitChangesStore.getState().treeCollapsed).toBe(true)
  })
})
