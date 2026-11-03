import { ShellTestIds as T } from '@pragma/sdk'
import { act, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { DockPosition, SidebarSide } from '../src/renderer/lib/dock-layout'
import { PanelToggles } from '../src/renderer/shell/TitleBar'
import { renderShell } from './lib/render-shell'

const iconOf = (testId: string) => screen.getByTestId(testId).querySelector('svg')?.getAttribute('class') ?? ''

test.each([
  ['right', 'left'],
  ['bottom', 'right'],
  ['left', 'right'],
  ['top', 'left'],
] as const satisfies readonly (readonly [DockPosition, SidebarSide])[])(
  'dock %s, sidebar %s: the toggles draw the panels where they are',
  async (dockPosition, sidebarSide) => {
    const r = await renderShell(<PanelToggles />)
    act(() => r.store.setState({ dockPosition, sidebarSide }))
    expect(iconOf(T.toggleRightPanel)).toContain(`lucide-panel-${dockPosition}`)
    expect(iconOf(T.toggleSidebar)).toContain(`lucide-panel-${sidebarSide}`)
    expect(screen.getByTestId(T.toggleRightPanel).getAttribute('aria-label')).toContain(`togglePanel.${dockPosition}`)
  },
)
