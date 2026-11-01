import { act, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TAB_STRIP_PX, TOOLBAR_PX, VIEW_INSET_TOP_PX } from '../../src/constants'
import { BROWSER_TEST_IDS as T } from '../../src/contract'
import { BrowserPanel } from '../../src/renderer/BrowserPanel'
import { buildSnapshot, buildTab } from '../lib/builders'
import { renderBrowser, text } from '../lib/renderer'

const two = buildSnapshot([buildTab({ id: 'a', title: 'Alpha' }), buildTab({ id: 'b', title: '', canGoBack: true })])

describe('BrowserPanel', () => {
  it('renders tab titles (untitled fallback)', () => {
    renderBrowser(<BrowserPanel />, { snapshot: two })
    expect(screen.getAllByTestId(T.tab).map((e) => e.textContent)).toEqual(['Alpha', text('tabs.untitled')])
  })

  it('back calls history with the active tab', () => {
    const r = renderBrowser(<BrowserPanel />, { snapshot: two })
    fireEvent.click(screen.getByTestId(T.back))
    expect(r.calls).toContainEqual({ channel: 'browser.history', input: { tabId: 'b', action: 'back' } })
  })

  it('back is disabled when the tab cannot go back', () => {
    renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot() })
    expect(screen.getByTestId(T.back)).toBeDisabled()
  })

  it('a port-only input offers localhost', () => {
    const r = renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot() })
    fireEvent.change(screen.getByTestId(T.addressBar), { target: { value: '3000' } })
    const suggestion = screen.getByTestId(T.addressSuggestion)
    expect(suggestion.textContent).toBe(text('address.suggestLocalhost', { url: 'http://localhost:3000/' }))
    fireEvent.click(suggestion)
    expect(r.calls).toContainEqual({
      channel: 'browser.navigate',
      input: { tabId: 't1', input: 'http://localhost:3000/' },
    })
  })

  it('Enter navigates; without tabs it opens a tab', () => {
    const r = renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot([], { activeWorktreeId: 'wtA' }) })
    expect(screen.getByText(text('empty.noTabs'))).toBeInTheDocument()
    const input = screen.getByTestId(T.addressBar)
    fireEvent.change(input, { target: { value: 'localhost:8080' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(r.calls).toContainEqual({ channel: 'browser.openTab', input: { url: 'http://localhost:8080/' } })
  })

  it('without the comments UI the pick button is disabled with a hint', () => {
    renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot(), comments: null })
    const pick = screen.getByTestId(T.pickToggle)
    expect(pick).toBeDisabled()
    expect(pick).toHaveAttribute('title', text('picker.unavailable'))
  })

  it('the pick button starts the picker; armed shows the banner', () => {
    const armed = buildSnapshot([buildTab()], { pickerArmedTabId: 't1' })
    const r = renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot() })
    fireEvent.click(screen.getByTestId(T.pickToggle))
    expect(r.calls).toContainEqual({ channel: 'browser.picker.start', input: { tabId: 't1' } })
    act(() => r.store.getState().applySnapshot(armed))
    fireEvent.click(screen.getByTestId(T.pickerCancel))
    expect(screen.getByTestId(T.pickerBanner)).toHaveTextContent(text('picker.banner'))
    expect(screen.queryByTestId(T.tabStrip)).toBeNull()
    expect(r.calls).toContainEqual({ channel: 'browser.picker.cancel', input: { tabId: 't1' } })
  })

  it('no active worktree → empty state', () => {
    renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot([], { activeWorktreeId: null }) })
    expect(screen.getByTestId(T.emptyState)).toHaveTextContent(text('empty.noWorktree'))
  })

  it('shows the load error in the view area', () => {
    const snap = buildSnapshot([buildTab({ loadError: { code: -102, description: 'ERR_CONNECTION_REFUSED' } })])
    renderBrowser(<BrowserPanel />, { snapshot: snap })
    expect(screen.getByTestId(T.loadError)).toHaveTextContent(
      text('error.loadFailed', { description: 'ERR_CONNECTION_REFUSED' }),
    )
  })

  it('tab strip + toolbar heights equal the view inset', () => {
    renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot() })
    const strip = Number.parseInt(screen.getByTestId(T.tabStrip).style.height, 10)
    const toolbar = Number.parseInt((screen.getByTestId(T.back).parentElement as HTMLElement).style.height, 10)
    expect([strip, toolbar]).toEqual([TAB_STRIP_PX, TOOLBAR_PX])
    expect(strip + toolbar).toBe(VIEW_INSET_TOP_PX)
  })

  it.each([
    [T.zoomIn, { action: 'in' }],
    [T.zoomOut, { action: 'out' }],
    [T.zoomReset, { action: 'reset' }],
  ])('%s zooms', (id, input) => {
    const r = renderBrowser(<BrowserPanel />, { snapshot: buildSnapshot() })
    fireEvent.click(screen.getByTestId(id))
    expect(r.calls).toContainEqual({ channel: 'browser.zoom', input: { tabId: 't1', ...input } })
  })

  it('tabs close, activate and open', () => {
    const r = renderBrowser(<BrowserPanel />, { snapshot: two })
    fireEvent.mouseDown(screen.getAllByTestId(T.tab)[0] as HTMLElement)
    fireEvent.click(screen.getAllByTestId(T.tabClose)[1] as HTMLElement)
    fireEvent.click(screen.getByTestId(T.newTab))
    fireEvent.click(screen.getByTestId(T.devtools))
    expect(r.calls.map((c) => c.channel)).toEqual(
      expect.arrayContaining(['browser.activateTab', 'browser.closeTab', 'browser.openTab', 'browser.toggleDevTools']),
    )
  })
})
