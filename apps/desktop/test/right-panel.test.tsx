import { CoreCommands, CoreIpc, ShellTestIds as T } from '@pragma/sdk'
import type { RightTabProps } from '@pragma/sdk/renderer'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { expect, test, vi } from 'vitest'
import { NativeSnapshots } from '../src/renderer/shell/NativeSnapshots'
import { RightPanel } from '../src/renderer/shell/RightPanel'
import { renderShell } from './lib/render-shell'

class FakeResizeObserver {
  observe() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', FakeResizeObserver)

/** Mount log of `Probe`, a tab body that prints its `visible` prop. */
const mounts: string[] = []
function Probe({ tabId, visible }: RightTabProps) {
  useEffect(() => void mounts.push(tabId), [tabId])
  return <p data-testid={`probe-${tabId}`}>{String(visible)}</p>
}

const setup = async () => {
  const r = await renderShell(
    <>
      <RightPanel />
      <NativeSnapshots />
    </>,
  )
  const tab = (id: string, order: number) =>
    act(() => {
      r.host.registries.registerRightTab({
        id,
        titleKey: `core:${id}`,
        icon: 'terminal',
        order,
        component: () => <p>{`body-${id}`}</p>,
      })
    })
  return { ...r, tab }
}

test('renders registered tabs sorted by order and switches content', async () => {
  const r = await setup()
  r.tab('b', 20)
  r.tab('a', 10)
  expect(screen.getAllByRole('tab').map((el) => el.getAttribute('data-testid'))).toEqual([
    T.rightTab('a'),
    T.rightTab('b'),
  ])
  expect(screen.getByTestId(T.rightTabContent('a'))).toBeVisible()
  fireEvent.click(screen.getByTestId(T.rightTab('b')))
  expect(screen.getByTestId(T.rightTabContent('b'))).toBeVisible()
  expect(screen.getByTestId(T.rightTabContent('a'))).not.toBeVisible()
})
test('tab components get `visible`: only the active tab of a shown panel; hidden tabs stay mounted', async () => {
  const r = await setup()
  mounts.length = 0
  act(() => {
    for (const [id, order] of [
      ['a', 10],
      ['b', 20],
    ] as const)
      r.host.registries.registerRightTab({ id, titleKey: `core:${id}`, icon: 'terminal', order, component: Probe })
  })
  const shown = () => ['a', 'b'].map((id) => screen.getByTestId(`probe-${id}`).textContent)
  expect(shown()).toEqual(['true', 'false'])
  fireEvent.click(screen.getByTestId(T.rightTab('b')))
  expect(shown()).toEqual(['false', 'true'])
  act(() => r.store.setState({ rightCollapsed: true }))
  expect(shown()).toEqual(['false', 'false'])
  act(() => r.store.setState({ rightCollapsed: false, settingsOpen: true }))
  expect(shown()).toEqual(['false', 'false'])
  act(() => r.store.setState({ settingsOpen: false }))
  expect(shown()).toEqual(['false', 'true'])
  expect(mounts).toEqual(['a', 'b'])
})
test('shows welcome when no tabs', async () => {
  await setup()
  expect(screen.getByTestId(T.rightPanelWelcome)).toBeInTheDocument()
})
test('core.activateRightTab activates tab', async () => {
  const r = await setup()
  r.tab('a', 10)
  r.tab('b', 20)
  await act(() => r.host.commands.execute(CoreCommands.activateRightTab, { id: 'b' }))
  expect(r.host.registries.store.getState().activeTab).toBe('b')
})
test('inactive tab reports null bounds', async () => {
  const r = await setup()
  const bounds = vi.spyOn(r.main.host.nativeViews, 'setTabBounds')
  r.tab('a', 10)
  r.tab('b', 20)
  await waitFor(() => expect(bounds).toHaveBeenCalledWith('b', null))
  expect(bounds).toHaveBeenCalledWith('a', expect.objectContaining({ width: expect.any(Number) }))
})
test('setBadge shows and clears badge', async () => {
  const r = await setup()
  r.tab('a', 10)
  act(() => r.host.registries.setBadge('a', 3))
  expect(screen.getByTestId(T.rightTabBadge('a'))).toHaveTextContent('3')
  act(() => r.host.registries.setBadge('a', null))
  expect(screen.queryByTestId(T.rightTabBadge('a'))).toBeNull()
})
test('tabs are icon-only: name in aria-label and tooltip, badge overlaid on the icon', async () => {
  const r = await setup()
  act(() => {
    r.host.registries.registerRightTab({
      id: 'named',
      titleKey: 'core:right.welcome',
      icon: 'terminal',
      order: 1,
      component: () => null,
    })
  })
  act(() => r.host.registries.setBadge('named', 719))
  const tab = screen.getByRole('tab', { name: 'Welcome' })
  expect(tab).toHaveAttribute('data-testid', T.rightTab('named'))
  expect(tab).toHaveAttribute('title', 'Welcome')
  expect(tab).not.toHaveTextContent('Welcome')
  expect(tab).toHaveTextContent(/^719$/)
  expect(tab.querySelector('svg')).not.toBeNull()
})
test('snapshot event renders an img at bounds; cleared removes it', async () => {
  const r = await setup()
  const bounds = { x: 1, y: 2, width: 30, height: 40 }
  act(() =>
    r.main.host.router.publish(CoreIpc.nativeViewsSnapshot, {
      viewId: 'v',
      bounds,
      dataUrl: 'data:image/png;base64,AA',
    }),
  )
  const img = await screen.findByTestId(T.nativeSnapshot('v'))
  expect(img).toHaveStyle({ left: '1px', top: '2px', width: '30px', height: '40px' })
  act(() => r.main.host.router.publish(CoreIpc.nativeViewsSnapshotCleared, { viewId: 'v' }))
  await waitFor(() => expect(screen.queryByTestId(T.nativeSnapshot('v'))).toBeNull())
})
