import { fireEvent, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { BROWSER_TEST_IDS as T } from '../../src/contract'
import { DevUrlStatus } from '../../src/renderer/DevUrlStatus'
import { buildSnapshot, buildTab } from '../lib/builders'
import { renderBrowser } from '../lib/renderer'

it('shows the dev url of the active tab and opens the browser tab', () => {
  const r = renderBrowser(<DevUrlStatus />, { snapshot: buildSnapshot([buildTab({ url: 'http://localhost:5173/x' })]) })
  const item = screen.getByTestId(T.devUrlStatus)
  expect(item).toHaveTextContent('localhost:5173')
  fireEvent.click(item)
  expect(r.raw.panels.activateRightTab).toHaveBeenCalledWith('browser')
})

it('renders nothing for a non-local page', () => {
  renderBrowser(<DevUrlStatus />, { snapshot: buildSnapshot([buildTab({ url: 'https://a.test/' })]) })
  expect(screen.queryByTestId(T.devUrlStatus)).toBeNull()
})
